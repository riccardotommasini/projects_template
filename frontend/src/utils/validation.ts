export const isPasswordValid = (password: string): boolean => {
    const hasMinLength = password.length >= 8
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecialChar = /[^a-zA-Z0-9]/.test(password)

    return hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar
}

export const isEmailValid = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}