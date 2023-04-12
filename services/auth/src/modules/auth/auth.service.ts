import { Injectable } from '@nestjs/common';
import { Session } from '@models/session.model';
import { InjectModel } from '@nestjs/sequelize';
import { RefreshTokenEventDto } from '@event-dto/refresh-token.event.dto';
import { UserLogoutEventDto } from '@event-dto/user-logout.event.dto';
import { LogEventDto } from '@event-dto/log.event.dto';
import { InformationLog } from '@mongo-schemas/log.schema';
import { Model } from 'mongoose';
import { InjectModel as InjectModelMongo } from '@nestjs/mongoose';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Session) private readonly sessionRepository: typeof Session,
    @InjectModelMongo(InformationLog.name)
    private readonly logger: Model<InformationLog>
  ) {}

  deleteRefreshToken({ userId }: UserLogoutEventDto) {
    return this.sessionRepository.destroy({ where: { userId } });
  }

  async logAuthAction(payload: LogEventDto) {
    const log = new this.logger(payload);
    await log.save();
  }
}
