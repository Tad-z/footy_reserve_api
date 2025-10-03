
import { UserInt } from '../interface';
import User from '../models/user';

export const getUserById = async (id: string) => {
    const user = await User.findById(id);
    return user;
}