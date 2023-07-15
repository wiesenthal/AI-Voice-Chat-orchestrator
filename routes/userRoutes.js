import { Router } from 'express';
import { authenticateJWT, getUserFromGoogleJWTPayload, authenticateUserInDB, createUserFromGoogleJWTPayload } from '../utils/userUtils.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

router.get('/google-client-id', (req, res) => {
    res.json({"client_id": process.env.GOOGLE_CLIENT_ID});
});

// change the above to a get request
router.get('/try-session-login', async (req, res) => {
    // try to get the user Id from the session
    try {
        const user = req.session.user;
        // check if the user exists in the database
        // TODO: check if the user has paid
        const userExists = await authenticateUserInDB(user);
        if (userExists) {
            res.send({ success: true });
        }
        else {
            res.send({ success: false });
        }
    }
    catch (err) {
        console.log(err);
        res.send({ success: false });
    }
});

router.post('/login', async (req, res) => {
    try {
        const payload = await authenticateJWT(req.body.token);
        if (!payload) {
            console.log(`User tried to log in with invalid token: ${req.body.token}`)
            res.status(401).send({ success: false });
            return;
        }

        console.log(`User logged in: ${JSON.stringify(payload)}`);
        // get user from database (or create new user)

        // check if the user exists in the database
        let user = await getUserFromGoogleJWTPayload(payload);

        if (!user) {
            // should send user to different UI here, but for now just automatically create a new user
            user = await createUserFromGoogleJWTPayload(payload);
        }

        if (!user) {
            console.log(`User creation failed for payload: ${JSON.stringify(payload)}`)
            res.status(401).send({ success: false });
            return;
        }

        // TODO: check if the user has paid

        req.session.user = user;
        res.send({ success: true });
    } catch (err) {
        console.log(err);
        res.status(401).send({ success: false });
    }
});

export default router;