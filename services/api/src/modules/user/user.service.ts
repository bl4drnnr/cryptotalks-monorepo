import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { SignUpDto } from '@dto/sign-up.dto';
import { UserSignUpEvent } from '@events/user-sign-up.event';
import { SignInDto } from '@dto/sign-in.dto';
import { UserSignInEvent } from '@events/user-sign-in.event';
import { ConfirmAccountEvent } from '@events/confirm-account.event';
import { UserLogoutEvent } from '@events/user-logout.event';
import {ResponseDto} from "@dto/response.dto";

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @Inject('USERS_SERVICE') private readonly userClient: ClientKafka,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientKafka
  ) {}

  signUp(payload: SignUpDto) {
    return this.userClient.send(
      'user_created',
      new UserSignUpEvent({ ...payload })
    );
  }

  signIn(payload: SignInDto) {
    return this.userClient.send(
      'user_sign_in',
      new UserSignInEvent({ ...payload })
    );
  }

  confirmAccount({ confirmationHash }: { confirmationHash: string }) {
    return this.userClient.send(
      'confirm_user_account',
      new ConfirmAccountEvent({ confirmationHash })
    );
  }

  logout({ userId }: { userId: string }) {
    this.authClient.emit('user_logout', new UserLogoutEvent({ userId }));
    return new ResponseDto();
  }

  onModuleInit(): any {
    this.userClient.subscribeToResponseOf('user_sign_in');
    this.userClient.subscribeToResponseOf('user_created');
    this.userClient.subscribeToResponseOf('confirm_user_account');
  }
}
