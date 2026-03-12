import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuthSessionDocument = HydratedDocument<AuthSession>;

@Schema({
  collection: 'auth_sessions',
  timestamps: true,
  versionKey: false,
})
export class AuthSession {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  refreshTokenHash: string;

  @Prop({ trim: true })
  userAgent?: string;

  @Prop({ trim: true })
  ip?: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: null })
  revokedAt?: Date | null;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);

AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
