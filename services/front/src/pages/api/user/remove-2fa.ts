import { AxiosError } from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';

import { Api } from '@api';

export default async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const { data } = await Api.post('/user/remove-2fa', req.body, {
      headers: { 'x-access-token': req.headers['x-access-token'] }
    });

    return res.json(data);
  } catch (error: any) {
    return res
      .status((error as AxiosError).response?.status as number)
      .json((error as AxiosError).response?.data);
  }
};
