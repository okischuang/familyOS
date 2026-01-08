import type { Alert, Solution } from '../types';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  AlertDetail: { alert: Alert };
  Solutions: { alert: Alert };
  Confirm: { alert: Alert; solution: Solution };
};
