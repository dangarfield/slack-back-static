const { WebClient } = require('@slack/web-api')
const request = require('request')

const fs = require('fs')
require('dotenv').config()

let web
const users = {}

const DATA_PATH = './_static/data/data.json'
const FILES_PATH = './_static/files'

const getUserName = async (userId) => {
  if (!users[userId]) {
    const userDetails = await web.users.info({user: userId})
    users[userId] = {
      name: userDetails.user.profile.display_name !== '' ? userDetails.user.profile.display_name : userDetails.user.profile.real_name,
      image_72: userDetails.user.profile.image_72,
      image_1024: userDetails.user.profile.image_1024
    }
    // console.log('getUserName', userDetails, userId, users[userId])
  }
  return users[userId].name
}
const loadData = () => {
  if (fs.existsSync(DATA_PATH)) {
    return JSON.parse(fs.readFileSync(DATA_PATH))
  } else {
    return {channels: [], files: [], users: []}
  }
}

const messageIdExists = (itemToCheck, list) => {
  for (const item of list) {
    if (item.client_msg_id === itemToCheck.client_msg_id) {
      return item
    }
  }
  return false
}
const idExists = (itemToCheck, list) => {
  for (const item of list) {
    if (item.id === itemToCheck.id) {
      return item
    }
  }
  return false
}
const writeData = (existingData, channels, files) => {
//   console.log('existingData', existingData.channels)

  // Combine saved and new channels data
  console.log('Combining saved and new channel data')
  for (const channel of channels) {
    const existingChannel = idExists(channel, existingData.channels)
    if (existingChannel) {
    //   console.log('channel DOES exist', channel.id)
      for (const message of channel.messages) {
        const existingMessage = messageIdExists(message, existingChannel.messages)
        if (existingMessage) {
        //   console.log('message DOES exist')
        // check if edited, if it is, overwrite it
        } else {
          existingChannel.messages.unshift(message)
        //   console.log('message NOT exist', message, channel.messages.length, existingChannel.messages.length)
        }
      }
      // sort messages by ts
      //   existingChannel.messages = channel.messages
      existingChannel.messages = existingChannel.messages.sort((a, b) => b.ts.localeCompare(a.ts))
    } else {
    //   console.log('channel NOT exist')
      channel.messages = channel.messages.sort((a, b) => b.ts.localeCompare(a.ts))
      existingData.channels.push(channel)
    }
  }
  console.log('existingData.channels', existingData.channels[7].messages.length, channels[7].messages.length)

  // Combine saved and new files data
  for (const file of files) {
    const existingFile = idExists(file, existingData.files)
    if (existingFile) {
    //   console.log('file DOES exist', file.id)
    } else {
    //   console.log('file DOES NOT exist', file.id)
      existingData.files.unshift(file)
    }
  }
  existingData.files = existingData.files.sort((a, b) => b.timestamp - a.timestamp)

  console.log('existingData.files', existingData.files.length, files.length)

  fs.writeFileSync(DATA_PATH, JSON.stringify({
    channels: existingData.channels,
    files: existingData.files,
    users
  }))
}
const getChannelData = async () => {
  const channels = (await web.conversations.list({types: 'public_channel, private_channel, mpim, im'})).channels

  for (const channel of channels) {
    console.log('channel im ->', channel.name, channel.user, channel.id)
    channel.messages = await web.paginate(
      'conversations.history',
      {channel: channel.id, oldest: 0},
      (res) => res.has_more === false, // temp - set to false
      async (acc, res, idx) => {
        if (acc === undefined) {
          acc = []
        }
        for (let message of res.messages) {
          message.display_name = await getUserName(message.user)
          if (message.thread_ts) {
            // console.log('Message with thread', message)
            const replies = (await web.conversations.replies({ts: message.thread_ts, channel: channel.id})).messages
            replies.shift()
            for (const reply of replies) {
              reply.display_name = await getUserName(reply.user)
            }
            // console.log('replies', replies)
            message.replies = replies
          }

          delete message.blocks
        }
        // console.log('acc', acc)
        acc = (await acc).concat(res.messages)
        console.log('       Found ', acc.length, 'messages')
        return acc
      }
    )
  }
  return channels
}
const downloadFile = async (file) => {
  const filePath = `${FILES_PATH}/${file.id}.${file.filetype}`
  if (!fs.existsSync(filePath)) {
    request({
      url: file.url_private,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
      }
    }).pipe(fs.createWriteStream(filePath))
  }
}
const getFiles = async () => {
  let isLastPage = false
  let page = 1
  const files = []
  while (!isLastPage) {
    // console.log('fetching', {page: page})
    const filesData = await web.files.list({page: page})
    page++
    if (filesData.paging.page === filesData.paging.pages) {
      isLastPage = true
    }
    for (const file of filesData.files) {
      file.display_name = await getUserName(file.user)
      files.push(file)
      await downloadFile(file)
    }
    console.log('filesData', filesData.paging, files.length)
  }
  return files
}

const init = async () => {
  web = new WebClient(process.env.SLACK_BOT_TOKEN)

  const existingData = await loadData()
  const channels = await getChannelData()
  const files = await getFiles()
  await writeData(existingData, channels, files)
  //   await generatePages(existingData)
  console.log('end')
}
init()
