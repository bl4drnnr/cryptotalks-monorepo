import * as bcryptjs from 'bcryptjs';
import * as crypto from 'crypto';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { SignUpDto } from '@dto/sign-up.dto';
import { UserSignUpEvent } from '@events/user-sign-up.event';
import { SignInDto } from '@dto/sign-in.dto';
import { ConfirmAccountEvent } from '@events/confirm-account.event';
import { UserLogoutEvent } from '@events/user-logout.event';
import { ResponseDto } from '@dto/response.dto';
import { UserAlreadyExistsException } from '@exceptions/user-already-exists.exception';
import { TacNotAcceptedException } from '@exceptions/tac-not-accepted.exception';
import { ValidationErrorException } from '@exceptions/validation-error.exception';
import { User } from '@models/user.model';
import { ConfirmationHash } from '@models/confirmation-hash.model';
import { InjectModel } from '@nestjs/sequelize';
import { ValidatorService } from '@shared/validator.service';
import { WrongCredentialsException } from '@exceptions/wrong-credentials.exception';
import { AccountNotConfirmedException } from '@exceptions/account-not-confirmed.exception';
import { HashNotFoundException } from '@exceptions/hash-not-found.exception';
import { EmailAlreadyConfirmedException } from '@exceptions/email-already-confirmed.exception';
import { AuthService } from '@modules/auth.service';
import { LogEvent } from '@events/log.event';
import { CloseAccEvent } from '@events/close-acc.event';
import { UpdateUserEvent } from '@events/update-user.event';
import { UserSettings } from '@models/user-settings.model';
import { EmailChangedException } from '@exceptions/email-changed.exception';
import sequelize, { Op } from 'sequelize';
import { UpdateUserEventDto } from '@event-dto/update-user.event.dto';
import { UpdateUserSecurityEvent } from '@events/update-user-security.event';
import { UpdateUserSecurityEventDto } from '@event-dto/update-user-security.event.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject('USERS_SERVICE') private readonly userClient: ClientKafka,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientKafka,
    @Inject('CRYPTO_SERVICE') private readonly cryptoClient: ClientKafka,
    @InjectModel(User) private readonly userRepository: typeof User,
    @InjectModel(UserSettings)
    private readonly userSettingsRepository: typeof UserSettings,
    @InjectModel(ConfirmationHash)
    private readonly confirmHashRepository: typeof ConfirmationHash,
    private readonly validatorService: ValidatorService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService
  ) {}

  async signUp(payload: SignUpDto) {
    const alreadyExistingUser = await this.userRepository.findOne({
      where: {
        [Op.or]: [
          {
            email: payload.email
          },
          {
            username: payload.username
          }
        ]
      }
    });
    if (alreadyExistingUser) throw new UserAlreadyExistsException();

    if (!payload.tac) throw new TacNotAcceptedException();

    if (
      !this.validatorService.validateEmail(payload.email) ||
      !this.validatorService.validatePassword(payload.password)
    )
      throw new ValidationErrorException();

    const hashedPassword = await bcryptjs.hash(payload.password, 10);

    const createdUser = await this.userRepository.create({
      ...payload,
      password: hashedPassword
    });

    const confirmationHash = crypto.randomBytes(20).toString('hex');

    this.authClient.emit(
      'log_auth_action',
      new LogEvent({
        event: 'SIGN_UP',
        message: `User ${payload.email} has successfully created an account.`,
        status: 'SUCCESS',
        timestamp: new Date()
      })
    );

    this.userClient.emit(
      'user_created',
      new UserSignUpEvent({
        email: payload.email,
        userId: createdUser.id,
        confirmationHash
      })
    );

    this.cryptoClient.emit(
      'crypto_for_user_created',
      new UserSignUpEvent({
        userId: createdUser.id
      })
    );

    return new ResponseDto();
  }

  async signIn(payload: SignInDto) {
    const user = await this.userRepository.findOne({
      where: { email: payload.email }
    });

    if (!user) throw new WrongCredentialsException();
    if (!user.accountConfirm) {
      this.authClient.emit(
        'log_auth_action',
        new LogEvent({
          event: 'SIGN_IN',
          message: `User ${user.email} tried to log in while being unconfirmed.`,
          status: 'ERROR',
          timestamp: new Date()
        })
      );
      throw new AccountNotConfirmedException();
    }

    const passwordEquality = await bcryptjs.compare(
      payload.password,
      user.password
    );
    if (!passwordEquality) throw new WrongCredentialsException();

    return this.authService.updateTokens({
      userId: user.id,
      email: user.email
    });
  }

  async confirmAccount({ confirmationHash }: { confirmationHash: string }) {
    const foundHash = await this.confirmHashRepository.findOne({
      where: { confirmationHash }
    });

    if (!foundHash) throw new HashNotFoundException();
    if (foundHash.confirmed) {
      this.authClient.emit(
        'log_auth_action',
        new LogEvent({
          event: 'CONFIRMATION',
          message: `User ${foundHash.id} tried to confirm account one more time.`,
          status: 'ERROR',
          timestamp: new Date()
        })
      );
      throw new EmailAlreadyConfirmedException();
    }

    this.authClient.emit(
      'log_auth_action',
      new LogEvent({
        event: 'CONFIRMATION',
        message: `User ${foundHash.id} has successfully confirmed an account.`,
        status: 'SUCCESS',
        timestamp: new Date()
      })
    );

    this.userClient.emit(
      'confirm_user_account',
      new ConfirmAccountEvent({
        hashId: foundHash.id,
        userId: foundHash.userId
      })
    );

    return new ResponseDto();
  }

  logout({ userId }: { userId: string }) {
    this.authClient.emit('user_logout', new UserLogoutEvent({ userId }));
    return new ResponseDto();
  }

  getUserPersonalInformation({ id }: { id: string }) {
    return this.userRepository.findByPk(id, {
      attributes: [
        'id',
        'email',
        [sequelize.literal('first_name'), 'firstName'],
        [sequelize.literal('last_name'), 'lastName'],
        'twitter',
        [sequelize.literal('linked_in'), 'linkedIn'],
        [sequelize.literal('personal_website'), 'personalWebsite'],
        'title',
        'bio',
        'username',
        'created_at'
      ]
    });
  }

  async changeEmail({ userId, email }: { userId: string; email: string }) {
    const existingUser = await this.userRepository.findOne({
      where: { email }
    });
    if (existingUser) throw new UserAlreadyExistsException();

    const currentUser = await this.userSettingsRepository.findOne({
      where: { userId }
    });
    if (currentUser.emailChanged) throw new EmailChangedException();

    if (!this.validatorService.validateEmail(email))
      throw new ValidationErrorException();

    // TODO Send email here and confirm it then

    this.userClient.emit(
      'update_user_account',
      new UpdateUserEvent({
        userId,
        email
      })
    );

    this.userClient.emit(
      'log_user_action',
      new LogEvent({
        event: 'USER',
        message: `User ${userId} has successfully changed email to ${email}`,
        status: 'SUCCESS',
        timestamp: new Date()
      })
    );

    return new ResponseDto();
  }

  changePassword({
    userId,
    password,
    passwordRepeat
  }: {
    userId: string;
    password: string;
    passwordRepeat: string;
  }) {
    if (
      !this.validatorService.validatePassword(password) ||
      !this.validatorService.validatePassword(passwordRepeat) ||
      passwordRepeat !== password
    )
      throw new ValidationErrorException();

    this.userClient.emit(
      'update_user_account',
      new UpdateUserEvent({
        userId,
        password
      })
    );

    this.userClient.emit(
      'log_user_action',
      new LogEvent({
        event: 'USER',
        message: `User ${userId} has successfully changed password`,
        status: 'SUCCESS',
        timestamp: new Date()
      })
    );

    return new ResponseDto();
  }

  closeAccount({ userId }: { userId: string }) {
    this.userClient.emit(
      'log_user_action',
      new LogEvent({
        event: 'CLOSE_ACC',
        message: `User ${userId} has successfully closed an account.`,
        status: 'SUCCESS',
        timestamp: new Date()
      })
    );

    this.userClient.emit('close_user_account', new CloseAccEvent({ userId }));

    return new ResponseDto();
  }

  setTwoFa(payload: UpdateUserSecurityEventDto) {
    this.userClient.emit(
      'update_user_security_settings',
      new UpdateUserSecurityEvent({ ...payload })
    );
    return new ResponseDto();
  }

  removeTwoFa(payload: UpdateUserSecurityEventDto) {
    this.userClient.emit(
      'update_user_security_settings',
      new UpdateUserSecurityEvent({ ...payload })
    );
    return new ResponseDto();
  }

  async getUserSettings({ userId }: { userId: string }) {
    const userPersonalSettings = await this.userRepository.findByPk(userId, {
      attributes: [
        'id',
        'email',
        [sequelize.literal('first_name'), 'firstName'],
        [sequelize.literal('last_name'), 'lastName'],
        'username',
        'twitter',
        [sequelize.literal('linked_in'), 'linkedIn'],
        [sequelize.literal('personal_website'), 'personalWebsite'],
        'title',
        'bio',
        [sequelize.literal('created_at'), 'createdAt']
      ]
    });

    const userSecuritySettings = await this.userSettingsRepository.findOne({
      where: { userId },
      attributes: [
        'phone',
        [sequelize.literal('public_email'), 'publicEmail'],
        [sequelize.literal('email_changed'), 'emailChanged'],
        [sequelize.literal('password_changed'), 'passwordChanged']
      ]
    });

    const securitySettings = {
      publicEmail: userSecuritySettings.publicEmail,
      emailChanged: userSecuritySettings.emailChanged,
      passwordChanged: userSecuritySettings.passwordChanged,
      phone: userSecuritySettings.phone,
      email: userPersonalSettings.email
    };
    delete userPersonalSettings.email;

    return { securitySettings, personalSettings: userPersonalSettings };
  }

  async setPersonalSettings(payload: UpdateUserEventDto) {
    const existingUser = await this.userRepository.findOne({
      where: { username: payload.username }
    });

    if (existingUser && existingUser.id !== payload.userId) {
      throw new UserAlreadyExistsException(
        'username-taken',
        'Username is taken'
      );
    }

    this.userClient.emit(
      'log_user_action',
      new LogEvent({
        event: 'USER',
        message: `User ${
          payload.userId
        } has successfully updated personal settings ${JSON.stringify(
          payload
        )}`,
        status: 'SUCCESS',
        timestamp: new Date()
      })
    );

    this.userClient.emit(
      'update_user_account',
      new UpdateUserEvent({ ...payload })
    );

    return new ResponseDto();
  }
}
