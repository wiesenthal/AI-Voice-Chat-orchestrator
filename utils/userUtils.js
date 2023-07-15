import dotenv from 'dotenv';
dotenv.config();

import { OAuth2Client } from 'google-auth-library';
import { v4 } from 'uuid';

import { dbQueryPool } from '../services/database.js';
import User from '../models/User.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function authenticateJWT(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    try {
        const payload = ticket.getPayload();
        return payload;
    }
    catch (err) {
        console.log(err);
        return null;
    }

}

export async function getUserFromGoogleJWTPayload(payload) {
    const googleSub = payload.sub;

    try {
        const [rows] = await dbQueryPool.execute('SELECT * FROM users WHERE google_sub = ?;', [googleSub]);
        
        if (rows.length > 0) {
            return User.fromRow(rows[0]);
        } else if (rows.length == 0) {
            return null;
        } else {
            console.error(`Found multiple users with google_sub = ${googleSub}`);
            return null;
        }
    }
    catch (err) {
        console.error(err);
        return null;
    }
}

export async function createUserFromGoogleJWTPayload(payload) {
    const userID = v4();
    const googleSub = payload.sub;
    const email = payload.email;
    const name = payload.name;
    // start with payment expires in 100 years
    const paymentExpirationDate = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
    
    try {
        const [rows] = await dbQueryPool.execute('INSERT INTO users (user_id, google_sub, name, email, payment_expiration_date) VALUES (?, ?, ?, ?, ?);', [userID, googleSub, name, email, paymentExpirationDate]);
    }
    catch (err) {
        console.error(err);
        return null;
    }
        
    return new User(userID, googleSub, name, email, paymentExpirationDate);
}

export async function getUserFromID(userID) {
    // check if the user exists in the database
    const [rows] = await dbQueryPool.execute('SELECT * FROM users WHERE user_id = ?;', [userID]);

    if (rows.length > 0) {
        return User.fromRow(rows[0]);
    }
    else if (rows.length == 0) {
        return null;
    }
    else {
        console.error(`Found multiple users with user_id = ${userID}`);
        return null;
    }
}

export async function authenticateUserInDB(user) {
    if (!user || !user.userID) {
        return false;
    }

    const userInDB = await getUserFromID(user.userID);

    // if the two are not null and not equal then something is wrong
    if (user && userInDB && user.userID === userInDB.userID) {
        return true;
    } else {
        return false;
    }
}

export async function hasUserPaid(userId) {
    /* TODO: Implement this function */
    return true;
}