// handlers/notification.js

const AWS = require('aws-sdk');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const docClient = new AWS.DynamoDB.DocumentClient();
const rds = new RDSDataClient({});
const ses = new SESClient({});

const {
    TASKS_TABLE,
    DB_CLUSTER_ARN,
    DB_SECRET_ARN,
    DB_NAME,
    SES_FROM_EMAIL,
} = process.env;

exports.handler = async (event) => {
    console.log('notify.handler received event:', JSON.stringify(event));

    for (const record of event.Records) {
        let userId, taskId, action;
        try {
            ({ userId, taskId, action } = JSON.parse(record.body));
        } catch (err) {
            console.error('Invalid record body', record.body);
            continue;
        }

        // 1) Fetch the task from DynamoDB to get its title and dueDate
        let task;
        try {
            const { Item } = await docClient
                .get({
                    TableName: TASKS_TABLE,
                    Key: { userId, taskId },
                })
                .promise();

            task = Item;
            if (!task) {
                console.error('No task record for', taskId);
                continue;
            }
        } catch (err) {
            console.error('DynamoDB get error:', err);
            continue;
        }

        const taskTitle = task.title || taskId;
        const dueDate = task.dueDate || 'Not specified';

        // 2) Fetch the user’s email via RDS Data API
        let sqlResult;
        try {
            sqlResult = await rds.send(
                new ExecuteStatementCommand({
                    resourceArn: DB_CLUSTER_ARN,
                    secretArn: DB_SECRET_ARN,
                    database: DB_NAME,
                    sql: 'SELECT email FROM users WHERE id = :uid',
                    parameters: [{ name: 'uid', value: { stringValue: userId } }],
                })
            );
        } catch (err) {
            console.error('RDSData error:', err);
            continue;
        }

        if (!sqlResult.records?.length) {
            console.error('No user record for', userId);
            continue;
        }
        const userEmail = sqlResult.records[0][0].stringValue;

        // 3) Send the notification email
        const now = new Date().toLocaleString();
        const emailParams = {
            Source: SES_FROM_EMAIL,
            Destination: { ToAddresses: [userEmail] },
            Message: {
                Subject: { Data: `🔔 Task ${action}: ${taskTitle}` },
                Body: {
                    Text: {
                        Data: `Hi there!\nYour task (“${taskTitle}”) was ${action} on ${now}.\nDue date: ${dueDate}\n`
                    },
                    Html: {
                        Data: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: auto; padding: 20px; }
      .header { font-size: 24px; margin-bottom: 10px; }
      .card { border: 1px solid #ddd; border-radius: 4px; padding: 15px; }
      .btn { display: inline-block; margin-top: 15px; padding: 10px 20px;
             background: #007bff; color: #fff; text-decoration: none;
             border-radius: 4px; }
      .footer { font-size: 12px; color: #999; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Task ${action}</div>
      <div class="card">
        <p><strong>Title:</strong> ${taskTitle}</p>
        <p><strong>Due date:</strong> ${dueDate}</p>
        <p><strong>When:</strong> ${now}</p>
      </div>
      <a class="btn" href="https://your-app.com/tasks/${taskId}">View Task</a>
      <div class="footer">
        You’re receiving this because you’ve signed up for CloudTaskMgr notifications.
      </div>
    </div>
  </body>
</html>`
                    }
                }
            }
        };

        try {
            await ses.send(new SendEmailCommand(emailParams));
            console.log(`Sent notification to ${userEmail} for ${action} of ${taskId}`);
        } catch (err) {
            console.error('SES send error:', err);
        }
    }
};
