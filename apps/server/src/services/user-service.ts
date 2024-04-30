import { singleton } from 'tsyringe';
import { DatabaseService } from './database-service/database-service';
import { Document } from 'mongodb';
import { Request, Response, RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { body, validationResult } from 'express-validator';
import User from '../models/user';
import { StatusCodes } from 'http-status-codes';
import { DocumentDefinition } from 'mongoose';
import UserSchema, { IUser } from '../models/user';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../utils/env';

@singleton()
export class UserService {
    constructor(private readonly databaseService: DatabaseService) {}

    getMessage() {
        return 'Hello world! ';
    }

    pingDb(): Promise<Document> {
        return this.databaseService.client.db('admin').command({ ping: 1 });
    }

    public user_create_post: RequestHandler[] = [
        // Validate and sanitize fields.
        body('username', 'Title must not be empty.').trim().isLength({ min: 1 }).escape(),
        body('mail', 'Author must not be empty.').trim().isLength({ min: 1 }).escape(),
        body('password', 'Summary must not be empty.').trim().isLength({ min: 1 }).escape(),
        // Process request after validation and sanitization.

        asyncHandler(async (req: Request, res: Response) => {
            // Extract the validation errors from a request.
            const errors = validationResult(req);

            // const passwordHash = crypto.createHash('sha256').update(req.body.password).digest('hex');
            // http://localhost:8888/user/create?username=momo&mail=a@gmail.com&password=azerty
            // Create a Book object with escaped and trimmed data.
            const user = new User({
                username: req.body.username,
                mail: req.body.mail,
                passwordHash: req.body.password,
            });

            if (!errors.isEmpty()) {
                // There are errors. Render form again with sanitized values/error messages.
            } else {
                // Data from form is valid. Save book.
                try {
                    await user.save();
                    res.status(StatusCodes.OK).send('user saved !!!');
                } catch (error) {
                    console.error(error);
                    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('Error saving user');
                }
            }
        }),
    ];

    public async login(user: DocumentDefinition<IUser>) {
        const foundUser = await UserSchema.findOne({ username: user.username });

        if (!foundUser) {
            throw new Error('UserName of user is not correct');
        }

        const isMatch = bcrypt.compareSync(user.passwordHash, foundUser.passwordHash);

        if (isMatch) {
            const token = jwt.sign({ _id: foundUser._id?.toString(), name: foundUser.name }, env.SECRET_KEY, {
                expiresIn: '2 days',
            });

            return { user: { id: foundUser.userId, username: foundUser.username }, token: token };
        } else {
            throw new Error('Password is not correct');
        }
    }
}
