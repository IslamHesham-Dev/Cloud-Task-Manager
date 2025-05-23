const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const CLIENT_ID = process.env.USER_POOL_CLIENT;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

module.exports.signUp = async (event) => {
    const { email, password, name } = JSON.parse(event.body);
    await cognito.signUp({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'name', Value: name },
        ],
    }).promise();

    return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ message: 'Signup successful' }),
    };
};

module.exports.confirmSignUp = async (event) => {
    const { email, code } = JSON.parse(event.body);
    await cognito.confirmSignUp({
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
    }).promise();

    return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ message: 'Confirmation successful' }),
    };
};

module.exports.signIn = async (event) => {
    const { email, password } = JSON.parse(event.body);
    const resp = await cognito.initiateAuth({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: password },
    }).promise();

    return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify(resp.AuthenticationResult),
    };
};