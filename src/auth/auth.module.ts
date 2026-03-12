import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthSession, AuthSessionSchema } from './schemas/auth-session.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuthSession.name, schema: AuthSessionSchema },
    ]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [MongooseModule, AuthService],
})
export class AuthModule {}
