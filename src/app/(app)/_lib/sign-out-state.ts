export type SignOutActionState = {
  error: string | null;
};

export type SignOutAction = () => Promise<SignOutActionState>;

export const initialSignOutActionState: SignOutActionState = {
  error: null,
};
