import express from "express";
import { DecodedTokenInt } from "../../interface";
import { Multer } from "multer";

declare global {
  namespace Express {
    interface Request {
      user?: DecodedTokenInt;
      file?: Multer.File;
    }
  }
}