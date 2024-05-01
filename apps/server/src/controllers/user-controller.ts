import { NextFunction, Request, Response, Router } from 'express';
import { body, validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';
import { singleton } from 'tsyringe';
import { UserService } from '../services/user-service';
import { AbstractController } from './abstract-controller';
import { AuthRequest, auth } from '../middleware/auth';
import { HttpException } from '../models/http-exception';

@singleton()
export class UserController extends AbstractController {
    constructor(private readonly userService: UserService) {
        super();
    }

    protected configureRoutes(router: Router) {
        router.post(
            '/login',
            body('username', 'is required').trim().isLength({ min: 1 }),
            body('password', 'is required').trim().isLength({ min: 1 }),
            async (req: Request<object, object, { username: string; password: string }>, res, next) => {
                try {
                    const errors = validationResult(req);
                    if (!errors.isEmpty()) {
                        throw new HttpException(StatusCodes.BAD_REQUEST, 'Invalid request', errors);
                    }

                    res.status(StatusCodes.OK).send(await this.userService.login(req.body.username, req.body.password));
                } catch (error) {
                    next(error);
                }
            },
        );

        router.post(
            '/user/create',
            body('username', 'is required').trim().notEmpty(),
            body('mail', 'is required').trim().notEmpty(),
            body('mail', 'must be a valid email').isEmail(),
            body('password', '`password` of length >=5 is required').trim().isLength({ min: 5 }),
            body('birthday', '`birthday` must be a valid date').isISO8601().toDate().optional(),
            async (req: AuthRequest, res, next) => {
                try {
                    const errors = validationResult(req);
                    if (!errors.isEmpty()) {
                        throw new HttpException(StatusCodes.BAD_REQUEST, 'Invalid request', errors);
                    }

                    res.status(StatusCodes.OK).send(
                        await this.userService.signup(
                            req.body.username,
                            req.body.mail,
                            req.body.password,
                            req.body.name,
                            req.body.surname,
                            req.body.birthday,
                            req.body.factChecker,
                            req.body.organization,
                        ),
                    );
                } catch (e) {
                    next(e);
                }
            },
        );

        router.post(
            '/user/trustUser',
            auth,
            body('otherUserId', 'is required').trim().isLength({ min: 1 }),
            async (req: AuthRequest<object, { otherUserId: string }>, res: Response, next: NextFunction) => {
                try {
                    const errors = validationResult(req);
                    if (!errors.isEmpty()) {
                        throw new HttpException(StatusCodes.BAD_REQUEST, 'Invalid request', errors);
                    }

                    await this.userService.trustUser(req.user!._id, req.body.otherUserId);
                    res.status(StatusCodes.NO_CONTENT).send();
                } catch (error) {
                    next(error);
                }
            },
        );

        router.post(
            '/user/untrustUser',
            auth,
            body('otherUserId', 'is required').trim().isLength({ min: 1 }),
            async (req: AuthRequest<object, { otherUserId: string }>, res: Response, next: NextFunction) => {
                try {
                    const errors = validationResult(req);
                    if (!errors.isEmpty()) {
                        throw new HttpException(StatusCodes.BAD_REQUEST, 'Invalid request', errors);
                    }

                    await this.userService.untrustUser(req.user!._id, req.body.otherUserId);
                    res.status(StatusCodes.NO_CONTENT).send();
                } catch (error) {
                    next(error);
                }
            },
        );

        router.post(
            '/user/visitUserProfile',
            auth,
            body('otherUserId', 'is required').trim().isLength({ min: 1 }),
            async (req: AuthRequest<object, { otherUserId: string }>, res: Response, next: NextFunction) => {
                try {
                    const errors = validationResult(req);
                    if (!errors.isEmpty()) {
                        throw new HttpException(StatusCodes.BAD_REQUEST, 'Invalid request', errors);
                    }

                    res.status(StatusCodes.OK).send(await this.userService.getUserProfile(req.body.otherUserId));
                } catch (error) {
                    next(error);
                }
            },
        );
    }
}