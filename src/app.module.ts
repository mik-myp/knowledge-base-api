import { StorageModule } from './storage/storage.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './common/utils/jwt.strategy';
import { AllExceptionsFilter } from './common/filters/exception.filter';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptor/response.interceptor';
import { MongooseModule } from '@nestjs/mongoose';
import { mongooseSerializePlugin } from './common/plugins/mongoose-serialize.plugin';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/guard/jwt-auth.guard';
import { UsersModule } from './users/users.module';
import { KnowledgeBasesModule } from './knowledge_bases/knowledge_bases.module';
import { DocumnetsModule } from './documnets/documnets.module';

@Module({
  imports: [
    StorageModule,
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
          'mongodb://localhost:27017/knowledge-base-api',
        serverApi: {
          version: '1',
          strict: true,
          deprecationErrors: true,
        },
        dbName: 'knowledge',
        connectionFactory: (connection) => {
          connection.plugin(mongooseSerializePlugin);
          return connection;
        },
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const accessTokenSecret =
          configService.get<string>('JWT_ACCESS_SECRET') ??
          'knowledge-base-api-access';
        const accessTokenExpiresIn =
          configService.get<JwtSignOptions['expiresIn']>(
            'JWT_ACCESS_EXPIRESIN',
          ) ?? '15m';

        return {
          secret: accessTokenSecret,
          signOptions: {
            expiresIn: accessTokenExpiresIn,
          },
        };
      },
      inject: [ConfigService],
      global: true,
    }),
    PassportModule,
    UsersModule,
    KnowledgeBasesModule,
    DocumnetsModule,
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
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    AppService,
    JwtStrategy,
  ],
})
export class AppModule {}
