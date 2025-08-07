import express, { Application, Request, Response } from "express";
import morgan from 'morgan';
import dotenv from "dotenv";
import main from "./models/db";
import userRouter from "./routes/user"; 


dotenv.config();

const app: Application = express();
const PORT: number = 3001;


main()
  .then(() => {
    app.listen(PORT, (): void => {
      console.log("SERVER IS UP ON PORT:", PORT);
    });
    console.log("DB connected");
  })
  .catch(console.error);
app.use(morgan('dev')); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req: Request, res: Response) => {
  res.send("Footy Reserve API")
})

app.use("/user", userRouter);
