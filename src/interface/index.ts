import { Schema } from 'mongoose';

export type UserInt = {
    _id?: Schema.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    country: string;
    image?: string;
    refreshToken?: string
    deviceToken?: string[];
    };

export type DecodedTokenInt = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}