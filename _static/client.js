let DATA_PATH
const FILES_PATH = 'files'
let data
let router
let miniSearch

const groupBy = (x, f) => x.reduce((a, b) => ((a[f(b)] ||= []).push(b), a), {});

const stringFromDate = (jsDate) => {
  return `${jsDate.getDate()}/${jsDate.getMonth() + 1}/${jsDate.getFullYear()}`
}
const dateFromString = (stDate) => {
  const parts = stDate.split('/')
  return new Date(parts[2], parts[1] - 1, parts[0])
}
const urlStringFromString = (stDate) => {
  return stDate.replaceAll('/', '-')
}
const stringFromUrlString = (urlDate) => {
  return urlDate.replaceAll('-', '/')
}
const getDataUrl = async () => {
  if (window.location.href.includes('localhost')) {
    return 'data/data.json'
  } else {
    // Hacky example - Just use any password protected static site
    let password = window.localStorage.getItem('password')
    if (!password) {
      password = window.prompt('Enter password')
    }
    const authReq = await window.fetch('/.netlify/functions/auth/auth.js', {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      },
      body: JSON.stringify({auth: password})
    })
    const authRes = await authReq.json()
    if (authRes.dataPath) {
      window.localStorage.setItem('password', password)
      return authRes.dataPath
    }
  }
}
const getData = async () => {
  const req = await window.fetch(DATA_PATH)
  data = await req.json()
  for (const channel of data.channels) {
    channel.messages.reverse()
    for (const message of channel.messages) {
      const jsDate = new Date(1000 * parseInt(message.ts.split('.')[0]))
      message.day = stringFromDate(jsDate)
      message.time = `${jsDate.getHours()}:${(jsDate.getMinutes() + '').padStart(2, '0')}`
    }
    channel.messagesByDate = groupBy(channel.messages, v => v.day)
  }
  data.space_name = 'A&D'
  console.log('data', data)
}
const setTitle = (text1, text2, text3) => {
  document.querySelector('.page-title').textContent = `${data.space_name} - ${text1} - ${text2} - ${text3}`
}
const renderNav = async () => {
  // Space name
  setTitle('', '', '')
  document.querySelector('title').textContent = `${data.space_name} | slack-back`

  // Channels
  for (const channel of data.channels) {
    if (channel.is_channel) {
      const h = `<li class="nav-item">
            <a class="nav-link channel w-100" href="#" data-channel="${channel.id}">
                <i class="bi-hash"></i>
                ${channel.name}
                <span class="badge rounded-pill text-bg-secondary pull-right">${channel.messages.length}</span>
            </a>
        </li>`

      document.querySelector('.channel-list').innerHTML += h
    } else if (channel.is_im) {
      let name = channel.user
      if (data.users[channel.user]) {
        name = data.users[channel.user].name
      }
      const h = `<li class="nav-item">
            <a class="nav-link channel w-100" href="#" data-channel="${channel.id}">
                <i class="bi-chat-dots"></i>
                ${name}
                <span class="badge rounded-pill text-bg-secondary pull-right">${channel.messages.length}</span>
            </a>
        </li>`
      if (channel.messages.length > 0) {
        document.querySelector('.im-list').innerHTML += h
      }
    }
  }
  // Bind channel clicks
  for (const channelLink of Array.from(document.querySelectorAll('a.channel'))) {
    channelLink.addEventListener('click', function (e) {
      e.preventDefault()
      const channelId = channelLink.getAttribute('data-channel')
      //   console.log('channel click', channelId)
      const latestDate = getLatestChannelMessageDate(channelId)
      // loadChannel(channelId, latestDate)
      router.navigateTo(`channel/${channelId}/${urlStringFromString(latestDate)}`)
    })
  }
  document.querySelector('a.nav-link.files').addEventListener('click', function (e) {
    e.preventDefault()
    router.navigateTo('files/1')
  })
}
const showFiles = async (page) => {
  const pageLength = 50
  const maxPage = Math.ceil(data.files.length / pageLength)
  const filesOnPage = data.files.slice(pageLength * (page - 1), (pageLength * (page - 1)) + pageLength)
  console.log('showFiles page', page, maxPage, data.files.length)
  let navHtml = `<ul class="pagination justify-content-center">`
  for (let i = 1; i <= maxPage; i++) {
    navHtml += `<li class="page-item${page === i ? ' disabled' : ''}">
          <button class="page-link" data-page="${i}">${i}</button>
        </li>`
  }
  navHtml += '</ul>'
  let allHtml = ''
  allHtml += navHtml
  allHtml += '<div class="files">'

  for (const file of filesOnPage) {
    // TODO - not all files are images
    if (file.mimetype.includes('image')) {
      allHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank">
            <img class="img-thumbnail" src="${FILES_PATH}/${file.id}.${file.filetype}" />
          </a>`
    } else if (file.mimetype.includes('video')) {
      allHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank" class="btn btn-secondary m-1">
            <i class="bi bi-camera-reels big-icon"></i><br/>${file.name}
          </a>`
    } else if (file.mimetype.includes('audio')) {
      allHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank" class="btn btn-secondary m-1">
            <i class="bi bi-cassette big-icon"></i><br/>${file.name}
          </a>`
    } else if (file.mimetype.includes('pdf')) {
      allHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank" class="btn btn-secondary m-1">
            <i class="bi bi-file-pdf big-icon"></i><br/>${file.name}
          </a>`
    } else {
      allHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank" class="btn btn-secondary m-1">
            <i class="bi bi-file-earmark-arrow-down big-icon"></i><br/>${file.name}
          </a>`
    }
  }
  allHtml += '</div>'
  allHtml += navHtml
  setTitle('Files', `Page ${page}`, `${data.files.length} files`)
  document.querySelector('.content').innerHTML = allHtml
  for (const pageLink of Array.from(document.querySelectorAll('.pagination .page-link'))) {
    pageLink.addEventListener('click', function (e) {
      const linkPage = parseInt(pageLink.getAttribute('data-page'))
      router.navigateTo(`files/${linkPage}`)
    })
  }
  window.scrollTo({top: 0, behavior: 'instant'})
}
const loadChannelMessagesOnDate = (channel, date, datepicker, messageId) => {
  // console.log('channel loadChannelMessagesOnDate', channel, date)
  const messagesToAdd = channel.messagesByDate[date]
  // console.log('channel messagesToAdd', messagesToAdd)
  // Load pages of 100, load first page
  let name = channel.name
  if (data.users[channel.user]) {
    name = data.users[channel.user].name
  }

  // Bind when user scrolls all the way up to load the next slices and inject
  // const tStart = new Date()
  let allHtml = ''
  if (messagesToAdd) {
    const currDay = dateFromString(date)
    const orderedDates = Object.keys(channel.messagesByDate)
    const currDayIndex = orderedDates.indexOf(date)
    const prevDayIndex = currDayIndex-1
    const nextDayIndex = currDayIndex+1
    const prevDay = prevDayIndex > 0 ? orderedDates[prevDayIndex] : 'n/a'
    const nextDay = nextDayIndex < orderedDates.length ? orderedDates[nextDayIndex] : 'n/a'
    // console.log('channel.messagesByDate', channel.messagesByDate, orderedDates,
      // 'prev', prevDayIndex, prevDay, 'curr', currDayIndex, date, 'next', nextDayIndex, nextDay)
    let navHtml = '<ul class="pagination justify-content-center">'
    if(prevDay !== 'n/a') {
      navHtml += `<li class="page-item">
          <button class="page-link" data-date="${prevDay}">${prevDay}</button>
        </li>`
    }
    navHtml += `<li class="page-item disabled">
          <button class="page-link">${date}</button>
        </li>`
    if(nextDay !== 'n/a') {
      navHtml += `<li class="page-item">
          <button class="page-link" data-date="${nextDay}">${nextDay}</button>
        </li>`
    }
    navHtml += '</ul>'

    allHtml += navHtml
    let prevDisplayName = ''
    for (const messageToAdd of messagesToAdd) {
      let filesHtml = ''
      if (messageToAdd.files) {
        filesHtml += '<div class="files">'
        for (const file of messageToAdd.files) {
          // TODO - not all files are images
          if (file.mimetype.includes('image')) {
            filesHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank">
                      <img class="img-thumbnail" src="${FILES_PATH}/${file.id}.${file.filetype}" />
                    </a>`
          } else if (file.mimetype.includes('video')) {
            filesHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank" class="btn btn-secondary m-1">
                      <i class="bi bi-camera-reels big-icon"></i><br/>${file.name}
                    </a>`
          } else if (file.mimetype.includes('audio')) {
            filesHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank" class="btn btn-secondary m-1">
                      <i class="bi bi-cassette big-icon"></i><br/>${file.name}
                    </a>`
          } else if (file.mimetype.includes('pdf')) {
            filesHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank" class="btn btn-secondary m-1">
                      <i class="bi bi-file-pdf big-icon"></i><br/>${file.name}
                    </a>`
          } else {
            filesHtml += `<a href="${FILES_PATH}/${file.id}.${file.filetype}" target="_blank" class="btn btn-secondary m-1">
                      <i class="bi bi-file-earmark-arrow-down big-icon"></i><br/>${file.name}
                    </a>`
          }
        }
        filesHtml += '</div>'
      }

      const avatar = data.users[messageToAdd.user].image_72
      allHtml += `
        <div class="d-flex message-holder${messageId && messageToAdd.client_msg_id === messageId ? ' bg-info' : ''}" data-message="${messageToAdd.client_msg_id}">
            <div class="flex-shrink-0">
                ${prevDisplayName === messageToAdd.display_name ? '<span class="img-spaced"></span>' : `<img src="${avatar}" class="rounded avatar">`}
            </div>
            <div class="flex-grow-1 ms-3">
                ${prevDisplayName === messageToAdd.display_name ? '' : `
                <div class="info">
                    <span class="name"><b>${messageToAdd.display_name}</b></span> <span class="time">${messageToAdd.time}</span>
                </div>`}
                <div class="message">
                    ${lightMarkdown.toHtml(messageToAdd.text)}
                    ${messageToAdd.edited ? '(edited)' : ''}
                </div>
                ${filesHtml}
            </div>
        </div>`
      prevDisplayName = messageToAdd.display_name
    }
    allHtml += navHtml
    setTitle(name, date, `${messagesToAdd.length} messages`)
  } else {
    allHtml += '<h3>Nothing to display</h3>'
    setTitle(name, 'No date', `No messages`)
  }

  document.querySelector('.content').innerHTML = allHtml
  for (const pageLink of Array.from(document.querySelectorAll('.pagination .page-link'))) {
    pageLink.addEventListener('click', function (e) {
      const linkDate = pageLink.getAttribute('data-date')
      datepicker.setFullDate(dateFromString(linkDate))
      loadChannelMessagesOnDate(channel, linkDate, datepicker)
    })
  }
  // const tStop = new Date()
  // console.log('render time', tStop.getTime() - tStart.getTime(), 'ms -> ', messagesToAdd.length, 'messages')
  if (messageId) {
    const messageEle = document.querySelector(`.message-holder[data-message="${messageId}"]`)
    const y = messageEle.getBoundingClientRect().top + window.scrollY - 100;
    console.log('messageId', messageId, messageEle, y)
    window.scrollTo({top: y, behavior: 'instant'})
  } else {
    window.scrollTo({top: 0, behavior: 'instant'})
  }

}
const getLatestChannelMessageDate = (channelId) => {
  const channel = data.channels.find(channel => channel.id === channelId)
  let lastDate = ''
  for (const dateString in channel.messagesByDate) {
    lastDate = dateString
  }
  return lastDate
}
const loadChannel = async (channelId, intendedDate, messageId) => {
  // Style active / inactive channels
  const channel = data.channels.find(channel => channel.id === channelId)

  // Populate date list
  let firstDate = ''
  let lastDate = ''
  const allDates = []
  for (const dateString in channel.messagesByDate) {
    // console.log('dateString', dateString)
    if (firstDate === '') {
      firstDate = dateString
    }
    lastDate = dateString
    allDates.push(dateFromString(dateString))
  }
  // console.log('Date.parse', dateFromString(lastDate), dateFromString(stringFromDate(new Date())))

  const datepickerOptions = {
    el: '#datepicker',
    closeOnBlur: true,
    autoClose: true,
    selectedDate: dateFromString(lastDate),
    dateFormat: 'd/m/yyyy',
    markDates: allDates
  }
  if (firstDate !== lastDate) {
    datepickerOptions.minDate = dateFromString(firstDate)
    datepickerOptions.maxDate = dateFromString(lastDate)
  }
  const datepicker = MCDatepicker.create(datepickerOptions)

  datepicker.setFullDate(dateFromString(lastDate))
  datepicker.onSelect((date, formatedDate) => {
    console.log('Selected date: ' + date, stringFromDate(date))
    loadChannelMessagesOnDate(channel, stringFromDate(date), datepicker, messageId)
  })

  loadChannelMessagesOnDate(channel, intendedDate, datepicker, messageId)
}
const indexSearch = async () => {
  // console.log('indexSearch')
  miniSearch = new MiniSearch({
    fields: ['text'],
    storeFields: ['text', 'channelId', 'day', 'time', 'user', 'ts']
  })
  const docs = []
  for (const channel of data.channels) {
    for (const message of channel.messages) {
      if (message.client_msg_id) {
        docs.push({
          id: message.client_msg_id,
          text: message.text,
          channelId: channel.id,
          day: message.day,
          time: message.time,
          user: message.user,
          ts: parseInt(message.ts.split('.'))
        })
      }
    }
  }
  const tStart = new Date()

  // console.log('index docs', docs)
  miniSearch.addAll(docs)
  const tStop = new Date()
  console.log('index time', tStop.getTime() - tStart.getTime(), 'ms -> ', docs.length, 'docs')

  // Search init binding
  document.querySelector('#search-field').addEventListener('keyup', function (e) {
    const searchTerm = encodeURIComponent(this.value)
    router.navigateTo(`search/${searchTerm}`)
  })
}
const executeSearch = async (searchTerm) => {
  let results = miniSearch.search(searchTerm, { combineWith: 'AND' })
  results = results.sort((a,b) => b.ts - a.ts)
  const totalResults = results.length
  const resultsSliced = results.slice(0,50)
  const resultsTitle = totalResults !== resultsSliced.length ? `${resultsSliced.length} of ${totalResults} results` : `${resultsSliced.length} results`
  // console.log('search', searchTerm, resultsSliced, resultsTitle)
  setTitle('Search', searchTerm, resultsTitle)
  let allHtml = ''
  allHtml += `<h3>Search for '${searchTerm}' - ${resultsTitle} (Sorted by most recent message)</h3>`
  for (const result of resultsSliced) {
    const avatar = data.users[result.user].image_72
    const name = data.users[result.user].name
    const channel = data.channels.find(c => c.id === result.channelId)

    let channelName = 'Unknown'
    if (channel.is_channel) {
      channelName = channel.name
    } else if (channel.is_im) {
      channelName = channel.user
      if (data.users[channel.user]) {
        channelName = data.users[channel.user].name
      }
    }

    allHtml += `
      <div class="card p-3 mb-3 result" data-channel="${result.channelId}" data-date="${urlStringFromString(result.day)}" data-message="${result.id}">
        <div class="d-flex message-holder pb-0">
          <div class="flex-shrink-0">
              <img src="${avatar}" class="rounded avatar">
          </div>
          <div class="flex-grow-1 ms-3">
              <div class="info">
                  <span class="name"><b>${name}</b></span> <span class="time">${result.day} - ${result.time} (Channel: ${channelName})</span>
              </div>
              <div class="message">
                  ${lightMarkdown.toHtml(result.text)}
              </div>
          </div>
        </div>
      </div>`
  }
  document.querySelector('.content').innerHTML = allHtml
  for (const resultLink of Array.from(document.querySelectorAll('.result'))) {
    resultLink.addEventListener('click', function (e) {
      const channelId = resultLink.getAttribute('data-channel')
      const date = resultLink.getAttribute('data-date')
      const messageId = resultLink.getAttribute('data-message')
      console.log('Go to result', channelId, date, messageId)
      router.navigateTo(`channel/${channelId}/${date}/${messageId}`)
    })
  }
}
const initRouting = () => {
  router = new Router({
    mode: 'hash',
    page404: function (path) {
      console.log('"/' + path + '" Page not found')
    }
  })

  router.add('', function () {
    openLargestChannel()
  })

  const searchField = document.querySelector('#search-field')
  router.add('search', function () {
    executeSearch('')
  })
  router.add(/^search\/(.+)/i, function (searchTerm) {
    console.log('Open search per with term', searchTerm)
    const decodedSearchTerm = decodeURIComponent(searchTerm)
    if (searchField.value !== decodedSearchTerm) {
      searchField.value = decodedSearchTerm
    }
    executeSearch(decodedSearchTerm)
  })

  router.add('files/{page}', function (page) {
    console.log('Open files with page', page)
    showFiles(parseInt(page))
  })
  router.add('channel/{channelId}/{date}', function (channelId, urlDate) {
    const stDate = stringFromUrlString(urlDate)
    console.log('Open channel with date', channelId, stDate)
    loadChannel(channelId, stDate)
  })
  router.add('channel/{channelId}/{date}/{messageId}', function (channelId, urlDate, messageId) {
    const stDate = stringFromUrlString(urlDate)
    console.log('Open channel with date & messageId', channelId, stDate, messageId)
    loadChannel(channelId, stDate, messageId)
  })

  router.addUriListener()
  router.check()
  // router.navigateTo('hello/World')
}
const openLargestChannel = () => {
  let largestChannel = data.channels[0].id
  for (const channel of data.channels) {
    if (channel.messages.length > data.channels.find(ch => largestChannel === ch.id).messages.length) {
      largestChannel = channel.id
    }
  }
  document.querySelector(`a.channel[data-channel="${largestChannel}"]`).click()
}
const init = async () => {
  DATA_PATH = await getDataUrl()
  if (DATA_PATH) {
    await getData()
    await renderNav()
    await indexSearch()
    initRouting()
  } else {
    window.alert('Access Denied')
  }
}

init()
