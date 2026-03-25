import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * 定义用户文档的类型结构。
 */
export type UserDocument = HydratedDocument<User> & {
  comparePassword(password: string): Promise<boolean>;
};

/**
 * 定义用户状态的可选枚举值。
 */
export enum UserStatus {
  Active = 'active',
  Disabled = 'disabled',
}

/**
 * 定义用户相关逻辑。
 */
@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
})
export class User {
  /**
   * 保存用户邮箱。
   */
  @Prop({
    required: true,
    trim: true,
  })
  email: string;

  /**
   * 保存用户密码。
   */
  @Prop({ required: true })
  password: string;

  /**
   * 保存用户名。
   */
  @Prop({
    required: true,
    trim: true,
  })
  username: string;

  /**
   * 保存状态。
   */
  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.Active,
    required: true,
  })
  status: UserStatus;

  /**
   * 保存刷新令牌。
   */
  @Prop({
    type: String,
    default: undefined,
    trim: true,
  })
  refreshToken?: string;

  /**
   * 保存最近登录时间。
   */
  @Prop({
    type: Date,
    default: Date.now,
  })
  lastLoginAt?: Date;
}

/**
 * 定义用户Schema。
 */
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });

UserSchema.pre<UserDocument>('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);

  if (this.password) {
    this.password = await bcrypt.hash(this.password, salt);
  }
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password as string);
};
