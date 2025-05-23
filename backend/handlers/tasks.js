const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const TASKS_TABLE = process.env.TASKS_TABLE;

const CORS_TASKS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

module.exports.getTasks = async (event) => {
    const userId = event.requestContext.authorizer.claims.sub;
    const resp = await docClient.scan({
        TableName: TASKS_TABLE,
        FilterExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId },
    }).promise();

    return {
        statusCode: 200,
        headers: CORS_TASKS,
        body: JSON.stringify(resp.Items),
    };
};

module.exports.createTask = async (event) => {
    const { title, dueDate } = JSON.parse(event.body);
    const userId = event.requestContext.authorizer.claims.sub;
    const taskId = require('uuid').v4();
    const item = { taskId, userId, title, dueDate };

    await docClient.put({ TableName: TASKS_TABLE, Item: item }).promise();
    await new AWS.SQS().sendMessage({
        QueueUrl: process.env.NOTIF_QUEUE_URL,
        MessageBody: JSON.stringify({ userId, taskId, action: 'CREATED' }),
    }).promise();

    return {
        statusCode: 201,
        headers: CORS_TASKS,
        body: JSON.stringify(item),
    };
};

module.exports.updateTask = async (event) => {
    const userId = event.requestContext.authorizer.claims.sub;
    const taskId = event.pathParameters.id;
    const updates = JSON.parse(event.body);

    await docClient.update({
        TableName: TASKS_TABLE,
        Key: { userId, taskId },
        UpdateExpression: 'SET #t = :t',
        ExpressionAttributeNames: { '#t': 'title' },
        ExpressionAttributeValues: { ':t': updates.title },
    }).promise();

    await new AWS.SQS().sendMessage({
        QueueUrl: process.env.NOTIF_QUEUE_URL,
        MessageBody: JSON.stringify({ userId, taskId, action: 'UPDATED' }),
    }).promise();

    return {
        statusCode: 200,
        headers: CORS_TASKS,
        body: JSON.stringify({ message: 'Task updated' }),
    };
};

module.exports.deleteTask = async (event) => {
    const userId = event.requestContext.authorizer.claims.sub;
    const taskId = event.pathParameters.id;

    await docClient.delete({ TableName: TASKS_TABLE, Key: { userId, taskId } }).promise();

    return {
        statusCode: 204,
        headers: CORS_TASKS,
    };
};