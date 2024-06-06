const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const jwt = require('jsonwebtoken');

//pridobivanje imena tabele iz okoljskih spremenljivk
const JOBS_TABLE = process.env.JOBS_TABLE;

//ustvarjanje povezave z DynamoDB
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

//funckija za ustvarjanje žetona
const verifyToken = (event) => {
  const token = event.headers.Authorization || event.headers.authorization;

  if (!token) {
    throw new Error("No token provided");
  }

  try {
    //preverjanje žetona
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Failed to authenticate token");
  }
};

//funkcija za ustvarjanje opravila
module.exports.createJob = async (event) => {
  try {
    verifyToken(event);
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: error.message }),
    };
  }

  const { jobId, description } = JSON.parse(event.body);

  const params = {
    TableName: JOBS_TABLE,
    Item: { jobId, description },
  };

  try {
    const command = new PutCommand(params);
    await docClient.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({ jobId, description }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not create job" }),
    };
  }
};

//funkcija za pridobivanje
module.exports.getJobs = async (event) => {
  try {
    verifyToken(event);
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: error.message }),
    };
  }

  const params = {
    TableName: JOBS_TABLE,
  };

  try {
    const command = new ScanCommand(params);
    const data = await docClient.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify(data.Items),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve jobs" }),
    };
  }
};

//get ID
module.exports.getJob = async (event) => {
  try {
    verifyToken(event);
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: error.message }),
    };
  }

  const params = {
    TableName: JOBS_TABLE,
    Key: {
      jobId: event.pathParameters.id,
    },
  };

  try {
    const command = new GetCommand(params);
    const { Item } = await docClient.send(command);
    if (Item) {
      return {
        statusCode: 200,
        body: JSON.stringify(Item),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Could not find job with provided "jobId"' }),
      };
    }
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve job" }),
    };
  }
};

//update job
module.exports.updateJob = async (event) => {
  try {
    verifyToken(event);
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: error.message }),
    };
  }

  const { description } = JSON.parse(event.body);
  const jobId = event.pathParameters.id;

  const params = {
    TableName: JOBS_TABLE,
    Key: { jobId },
    UpdateExpression: 'set description = :d',
    ExpressionAttributeValues: {
      ':d': description,
    },
    ReturnValues: "UPDATED_NEW"
  };

  try {
    const command = new UpdateCommand(params);
    await docClient.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({ jobId, description }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not update job" }),
    };
  }
};

//delete job
module.exports.deleteJob = async (event) => {
  try {
    verifyToken(event);
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: error.message }),
    };
  }

  const jobId = event.pathParameters.id;
  const params = {
    TableName: JOBS_TABLE,
    Key: { jobId },
  };

  try {
    const command = new DeleteCommand(params);
    await docClient.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not delete job" }),
    };
  }
};

//clean old jobs
module.exports.cleanOldJobs = async () => {
  const now = new Date();
  now.setDate(now.getDate() - 30);

  const params = {
    TableName: JOBS_TABLE,
    FilterExpression: "createdAt < :cutoff",
    ExpressionAttributeValues: {
      ":cutoff": now.toISOString(),
    },
  };

  try {
    const command = new ScanCommand(params);
    const data = await docClient.send(command);
    const oldJobs = data.Items;

    for (const job of oldJobs) {
      const deleteParams = {
        TableName: JOBS_TABLE,
        Key: { jobId: job.jobId },
      };
      const deleteCommand = new DeleteCommand(deleteParams);
      await docClient.send(deleteCommand);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Old jobs cleaned" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not clean old jobs" }),
    };
  }
};

//SQS
module.exports.processMessage = async (event) => {
  try {
    const message = event.Records[0].body;
    console.log("Message received:", message);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Message processed" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not process message" }),
    };
  }
};

//logs
module.exports.analyzeLog = async (event) => {
  try {
    const logData = event.awslogs.data;
    const decodedLogData = Buffer.from(logData, 'base64').toString('utf8');
    const log = JSON.parse(decodedLogData);
    console.log("Log received:", log);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Log analyzed" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not analyze log" }),
    };
  }
};