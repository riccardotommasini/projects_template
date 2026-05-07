export type User = {
    userID: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
    pseudo: string;
    createdAt: string;
};

export type LoginDTO = {
    emailOrPseudo: string;
    password: string;
}

export type RegisterDTO = {
    email: string;
    password: string; // Il faut ?
    firstName: string;
    lastName: string;
    pseudo: string;
    avatarUri?: string;
}