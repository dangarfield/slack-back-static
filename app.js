const { WebClient, LogLevel } = require('@slack/web-api')
const request = require('request')

const fs = require('fs')
const path = require('path')
require('dotenv').config()

let channelsWithErrors = []
let web
const users = {}

const DATA_PATH = './_static/data/data.json'
const FILES_PATH = './_static/files'

const ensureCorrectUserName = (obj) => {
  if (obj.user === undefined) {
    obj.user = 'undefined'
  }
}
const getUserName = async (userId) => {
  if (!users[userId]) {
    try {
      const userDetails = await web.users.info({user: userId})
      users[userId] = {
        name: userDetails.user.profile.display_name !== '' ? userDetails.user.profile.display_name : userDetails.user.profile.real_name,
        image_72: userDetails.user.profile.image_72,
        image_1024: userDetails.user.profile.image_1024
      }
      // console.log('getUserName FETCHED', userId, users[userId])
    } catch (error) {
      users[userId] = {
        name: `Unknown - ${userId}`,
        image_72: 'https://ui-avatars.com/api/?name=un&size=72',
        image_1024: 'https://ui-avatars.com/api/?name=un&size=1024'
      }
      // console.log('getUserName ERROR', userId, users[userId])
    }
  }
  // console.log('getUserName ALREADY GOT', userId, users[userId])
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
  console.log('existingData.channels')//, existingData.channels[7].messages.length, channels[7].messages.length)

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
    
    console.log('Fetching channel -', channel.id, '->', channel.name ? `Channel: ${channel.name}` : `IM: ${await getUserName(channel.user)} (${channel.user})`)

    try {
      channel.messages = await web.paginate(
        'conversations.history',
        {channel: channel.id, team_id: process.env.SLACK_SPACE, oldest: 0},
        (res) => res.has_more === false, // temp - set to false
        async (acc, res, idx) => {
          if (acc === undefined) {
            acc = []
          }
          for (let message of res.messages) {
            ensureCorrectUserName(message)
            message.display_name = await getUserName(message.user)
            if (message.thread_ts) {
              // console.log('Message with thread', message)
              const replies = (await web.conversations.replies({ts: message.thread_ts, channel: channel.id})).messages
              replies.shift()
              for (const reply of replies) {
                ensureCorrectUserName(reply)
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
    } catch (error) {
      console.error('Channel error', error)
      channel.messages = []
      channelsWithErrors.push(channel)
    }
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
      ensureCorrectUserName(file)
      file.display_name = await getUserName(file.user)
      files.push(file)
      await downloadFile(file)
    }
    console.log('filesData', filesData.paging, files.length)
  }
  return files
}

const ensureDataFolders = async () => {
  const dataFolderPath = path.dirname(path.join(DATA_PATH))
  if (!fs.existsSync(dataFolderPath)) {
    fs.mkdirSync(dataFolderPath)
  }
  const filesFolderPath = path.join(FILES_PATH)
  if (!fs.existsSync(filesFolderPath)) {
    fs.mkdirSync(filesFolderPath)
  }
}

const init = async () => {
  let webclientOptions = {}
  if (process.argv.slice(2).includes('--log-debug')) {
    webclientOptions.logLevel = LogLevel.DEBUG
  }
  web = new WebClient(process.env.SLACK_BOT_TOKEN, webclientOptions)
  await ensureDataFolders()
  const existingData = await loadData()
  const channels = await getChannelData()
  const files = await getFiles()
  await writeData(existingData, channels, files)
  
  if (channelsWithErrors.length > 0) {
    for (const channel of channelsWithErrors) {
      const conversationInfo = await web.conversations.info({channel: channel.id})
      console.log('Channel with error', channel, 'full info:', conversationInfo)
    }
    console.log('Channels with error count:', channelsWithErrors.length)
  }
  console.log('End')
}
init()
