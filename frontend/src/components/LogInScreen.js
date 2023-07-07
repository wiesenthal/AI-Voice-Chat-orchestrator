import React, { useState, useEffect, useRef } from 'react';

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const LogInScreen = ({ user, setUser }) => {
    const [clientId, setClientId] = React.useState(null);

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
                console.log(data);
                // TODO: this is not secure
                if (data.success) {
                    setUser(data.success);
                }
            })
            );
    }

    useEffect(() => {
        // get client id from session


        fetch("/google-client-id")
            .then((res) => res.json())
            .then((data) => {
                setClientId(data.client_id);
            });
    }, []);

    if (clientId === null) {
        return <div>Loading...</div>;
    }

    if (!user) {
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
