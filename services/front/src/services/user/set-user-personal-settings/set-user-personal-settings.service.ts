import React from 'react';


import { ApiClient } from '@api-client';
import { ExceptionHandler } from '@exception-handler';
import {
  SetPersonalUserSettingsPayload, SetPersonalUserSettingsResponse
} from '@services/set-user-personal-settings/set-user-personal-settings.interface';

export const useSetPersonalUserSettingsService = () => {
  const [loading, setLoading] = React.useState(false);

  const setPersonalUserSettings = async (token: string | null, payload: SetPersonalUserSettingsPayload)
    : Promise<SetPersonalUserSettingsResponse> => {
    try {
      setLoading(true);
      const { data } = await ApiClient.patch<SetPersonalUserSettingsResponse>('/user/set-user-settings', payload, {
        headers: { 'Application-Authorization': `Bearer ${token}` }
      });

      return data;
    } catch (error: any) {
      throw ExceptionHandler(error);
    } finally {
      setLoading(false);
    }
  };

  return { setPersonalUserSettings, loading };
};
