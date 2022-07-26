const handler = async function (event, context) {
  console.log('event.body', event.body, process.env.STATIC_PASSWORD)
  const res = {
    dataPath: null
  }
  try {
    // Note: Set environment variable in netlify console
    if (JSON.parse(event.body).auth === process.env.STATIC_PASSWORD) {
      res.dataPath = '/data/data.json'
    }
  } catch (error) {
    // console.log('Error', error)
  }
  // console.log('res', res)
  return {
    statusCode: 200,
    body: JSON.stringify(res)
  }
}
module.exports = { handler }
