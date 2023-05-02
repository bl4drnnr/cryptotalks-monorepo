export interface IPersonalInformation {
  id: string;
  firstName: string;
  lastName: string;
  twitter: string;
  linkedIn: string;
  personalWebsite: string;
  title: string;
  bio: string;
  username: string;
  createdAt: string;
}

export interface ISecuritySettings {
  emailChanged: boolean;
  passwordChanged: Date;
  email: string;
  publicEmail: boolean;
  phone: string | null;
  twoFaToken: boolean;
}

export interface GetUserSettingsPayload {
  token: string | null;
}

export interface GetUserSettingsResponse {
  personalSettings: IPersonalInformation;
  securitySettings: ISecuritySettings;
}
