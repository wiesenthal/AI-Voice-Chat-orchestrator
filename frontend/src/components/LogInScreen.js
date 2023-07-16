import React, { useState, useEffect, useRef } from 'react';

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const LogInScreen = ({ isLoggedIn, setLoggedIn }) => {
    const [clientId, setClientId] = React.useState(null);
    const [hasTriedSessionLogin, setHasTriedSessionLogin] = React.useState(false);

    function signIn(credentialResponse) {
        let jwt = credentialResponse.credential;
        // Send jwt to backend
        fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ token: jwt }),
        })
            .then((res) => res.json()
            .then((data) => {
                if (data.success) {
                    setLoggedIn(data.success);
                }
            })
            );
    }

    useEffect(() => {
        // get client id from session
        console.log("Getting session login");
        fetch("/try-session-login")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    console.log("Got session login");
                    setLoggedIn(data.success);
                    setHasTriedSessionLogin(true);
                }
                else {
                    console.log("No session login");
                    setHasTriedSessionLogin(true);
                }
            });


        fetch("/google-client-id")
            .then((res) => res.json())
            .then((data) => {
                setClientId(data.client_id);
            });
    }, []);

    if (clientId === null || !hasTriedSessionLogin) {
        return <div>Loading...</div>;
    }

    if (!isLoggedIn) {
        return (
            <GoogleOAuthProvider
                clientId={clientId}
            >
                <GoogleLogin
                    onSuccess={signIn}
                    onError={error => console.log(error)}
                    useOneTap
                    auto_select
                />
            </GoogleOAuthProvider>
        )
    } else {
        return (
            <div>
                <h1>This should not be shown.</h1>
            </div>
        )
    }
}

export default LogInScreen;
