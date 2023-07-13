import { Router } from 'express';
import { dbQueryPool } from '../services/database.js';
import { authenticateJWT, doesUserExist, hasUserPaid } from '../services/authentication.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();

router.get('/google-client-id', (req, res) => {
    res.json({"client_id": process.env.GOOGLE_CLIENT_ID});
});

// change the above to a get request
router.get('/try-session-login', (req, res) => {
    // try to get the user Id from the session
    try {
        const userID = req.session.userID;
        if (userID) {
            res.send({ success: true });
        } else {
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
        console.log(`User logged in: ${JSON.stringify(payload)}`);
        // get user from database (or create new user)
        let userID = payload.sub;
        let email = payload.email;
        // test connection to database
        
        try {
            const [rows] = await dbQueryPool.execute('SHOW DATABASES;');
            console.log(`Successfully made database query. Rows: ${JSON.stringify(rows)}`);
        } catch(err) {
            console.log(err);
        }

        // If credentials are valid:
        req.session.userID = userID;  // Save something to session
        res.send({ success: true });
    } catch (err) {
        console.log(err);
        res.status(401).send({ success: false });
    }
});

export default router;