const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const BUCKET = process.env.ATTACH_BUCKET;

const CORS_ATTACH = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

module.exports.generateUploadUrl = async (event) => {
    const taskId = event.pathParameters.id;
    const key = `attachments/${taskId}/${Date.now()}.jpg`;
    const url = s3.getSignedUrl('putObject', {
        Bucket: BUCKET,
        Key: key,
        Expires: 300, // 5 minutes
    });

    return {
        statusCode: 200,
        headers: CORS_ATTACH,
        body: JSON.stringify({ uploadUrl: url, key }),
    };
};