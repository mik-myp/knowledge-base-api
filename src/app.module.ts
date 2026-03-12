import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './auth/jwt.strategy';
import { AllExceptionsFilter } from './common/filters/exception.filter';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptor/response.interceptor';
import { MongooseModule } from '@nestjs/mongoose';
import { mongooseSerializePlugin } from './common/plugins/mongoose-serialize.plugin';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/ai-learning-assistant',
        connectionFactory: (connection) => {
          connection.plugin(mongooseSerializePlugin);
          return connection;
        },
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          secret:
            configService.get<string>('JWT_SECRET') || 'ai-learning-assistant',
          signOptions: {
            expiresIn:
              configService.get<JwtSignOptions['expiresIn']>(
                'JWT_SECRET_EXPIRESIN',
              ) || '7d',
          },
        };
      },
      inject: [ConfigService],
      global: true,
    }),
    PassportModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    AppService,
    JwtStrategy,
  ],
})
export class AppModule {}
