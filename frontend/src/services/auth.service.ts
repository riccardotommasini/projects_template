import { supabase } from '../config/supabase';
import { RegisterDTO } from '../types/user';
import { apiFetch } from './api.service';
import { uploadAvatar } from './storage.service';
import { updateMyAvatar } from './users.service';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

export async function register(form: RegisterDTO) {
  const { data, error } = await supabase.auth.signUp({
    email: form.email,
    password: form.password,
  });

  if (error) throw error;

  const session = data.session;
  const user = data.user;

  if (!session|| !user) {
    throw new Error(
      "Aucune session ou utilisateur retourné après l'inscription. Vérifie que la confirmation email est bien désactivée dans Supabase.",
    );
  }

  try {
    await apiFetch('/users/me', {
      method: 'POST',
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        pseudo: form.pseudo,
      }),
    });
  } catch (e: any) {
    // Rollback : supprime l'utilisateur de Supabase Auth pour libérer l'email
    await apiFetch('/users/me', { method: 'DELETE' }).catch(() => {})
    throw new Error(e.message || "Impossible de créer le profil")
  }

  if (form.avatarUri) {
    const avatarPath = await uploadAvatar(form.avatarUri, user.id);
    await updateMyAvatar(avatarPath);
  }

  return data;
}


export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}