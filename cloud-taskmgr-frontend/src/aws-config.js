// src/aws-config.js
import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';

// Add debugging logs
console.log('Configuring AWS Amplify...');

// Configuration object for Amplify v6
export const awsConfig = {
    Auth: {
        Cognito: {
            userPoolId: 'us-east-1_OAush5WW0',
            userPoolClientId: '2e57revu20opqsvg7ubq0h1op1',
            loginWith: {
                email: true,
                phone: false,
                username: true
            }
        }
    },
    API: {
        REST: {
            CloudTaskMgrAPI: {
                endpoint: 'https://g6we97qfjf.execute-api.us-east-1.amazonaws.com/dev',
                region: 'us-east-1'
            }
        }
    },
    Storage: {
        S3: {
            bucket: 'cloud-taskmgr-attachments-122610479020',
            region: 'us-east-1'
        }
    }
};

// Log the configuration (without sensitive data)
console.log('AWS Config:', {
    userPoolId: awsConfig.Auth.Cognito.userPoolId,
    apiEndpoint: awsConfig.API.REST.CloudTaskMgrAPI.endpoint,
    bucket: awsConfig.Storage.S3.bucket
});

try {
    Amplify.configure(awsConfig);
    // Set up token signing for API requests
    cognitoUserPoolsTokenProvider.setKeyValueStorage({
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key)
    });
    console.log('AWS Amplify configured successfully');
} catch (error) {
    console.error('Error configuring AWS Amplify:', error);
}
