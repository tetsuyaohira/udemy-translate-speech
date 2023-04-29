'use strict'

chrome.storage.local.set({ userAgent: window.navigator.userAgent })

let captions = [] // 字幕リスト
const synth = document.defaultView.speechSynthesis
const UNAVAILABLE_MESSAGE =
  'It seems that "subtitle reading" is not available in this browser.\nPlease try another browser.'
const ERROR_MESSAGE =
  'There was a problem with "Udemy translate & speech".\nYou will need to reload the page to use it again.'
const SKIP_MESSAGE =
  'Video playback stopped due to delayed reading of subtitles.\nPlease adjust the reading speed from the settings screen.'
const DELETE_MESSAGE =
  'Deleted or disabled during "Udemy translate & speech" operation.'
const START_MESSAGE = 'Video playback has started.'
const ENABLE_MESSAGE = 'Currently, Udemy translate & speaker is enable.'
const DISABLE_MESSAGE = 'Currently, Udemy translate & speaker is disable.'
const CHANGE_VIDEO_ID_MESSAGE = 'The Video Id has been changed.'

const TARGET_CONTAINER_NODE = 'video-player--container--YDQRW' // <div class="video-player--container--YDQRW">
const TARGET_VIDEO_NODE = 'vjs-tech' // <video class="vjs-tech">
const TARGET_CAPTION_NODE1 = 'well--text--2H_p0' // <span class="well--text--2H_p0">
const TARGET_CAPTION_NODE2 = 'captions-display--captions-cue-text--ECkJu' // <div class="captions-display--captions-cue-text--ECkJu">

window.onload = async function start() {
  /* 合成音声インスタンスを抹消する（バグ対策） */
  synth.cancel()

  let isError = false
  const voicesList = await getVoiceList().then(
    (result) => result,
    (error) => {
      alert(error)
      isError = true
    }
  )
  if (isError) return

  // 合成音声（名前だけ）リストをストレージに保存
  let utteranceVoiceList = []
  voicesList.forEach((child) => utteranceVoiceList.push(child.name))
  chrome.storage.local.set({ utteranceVoiceList })

  const video = await getElement(TARGET_VIDEO_NODE)
  const videoId = video.id
  await observeVideo(videoId).then(
    (result) => console.log(result),
    (error) => {
      alert(error)
      isError = true
    }
  )
  if (isError) return

  video.onpause = () => synth.pause() // ビデオが一時停止の場合は発話も一時停止する

  video.onplay = () => synth.resume() // ビデオが再生中の場合は発話も再開する

  // ビデオエレメントを子に持つコンテナー
  const videoPlayer = await getElement(TARGET_CONTAINER_NODE)
  await observeCaption(videoPlayer, voicesList, videoId).then(
    (result) => console.log(result),
    (error) => {
      alert(error)
      isError = true
    }
  )
  if (isError) return

  captions = []

  await checkStatus().then(
    () => start(),
    (error) => alert(error)
  )
}

/**
 * Web Speech API の使用可能な合成音声（日本語）を取得する
 * @returns {Promise<Array>}
 */
async function getVoiceList() {
  return new Promise((resolve, reject) => {
    let count = 0
    const intervalId = setInterval(() => {
      const voices = synth.getVoices()

      if (voices.length !== 0) {
        clearInterval(intervalId)
        resolve(voices.filter((child) => child.lang === 'ja-JP'))
      }

      if (4 < ++count) {
        clearInterval(intervalId)
        reject('getVoiceList:\n' + UNAVAILABLE_MESSAGE)
      }
    }, 250)
  })
}

/**
 * 読み上げ機能オンオフを確認する
 * @returns {string}
 */
function checkStatus() {
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async () => {
      // 字幕読み上げの設定値
      const result = await getStorage().then(
        (result) => result,
        (error) => {
          clearInterval(intervalId)
          reject(error)
        }
      )

      if (result !== undefined && result.isEnabledSpeak === true) {
        clearInterval(intervalId)
        resolve(ENABLE_MESSAGE)
      }
    }, 2000)
  })
}

/**
 * クラス属性名をもとにエレメントを取得する
 * @param {string} attributeName
 * @returns {Promise<HTMLVideoElement>} elements
 */
function getElement(attributeName) {
  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      const TARGET = document.getElementsByClassName(attributeName)[0]

      if (TARGET !== undefined) {
        clearInterval(intervalId)

        resolve(TARGET)
      }
    }, 500)
  })
}

/**
 * ブラウザ（アカウント）ストレージに保存した設定値などを取得する
 * @returns {Promise<unknown>}
 */
function getStorage() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(null, resolve)
    } catch {
      reject('getStorage:\n' + DELETE_MESSAGE)
    }
  })
}

/**
 * ビデオが再生中かを監視する
 * @param {string} videoId
 * @returns resolve or reject
 */
function observeVideo(videoId) {
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(() => {
      try {
        const video = document.getElementById(videoId)

        if (video !== null && video.paused === false) {
          clearInterval(intervalId)
          resolve(START_MESSAGE)
        }
      } catch {
        clearInterval(intervalId)
        reject('observeVideo:\n' + ERROR_MESSAGE)
      }
    }, 500)
  })
}

/**
 * 字幕を監視する、読み上げる
 * @param targetNode
 * @param voices
 * @param videoId
 * @returns {Promise<unknown>}
 */
function observeCaption(targetNode, voices, videoId) {
  return new Promise(async (resolve, reject) => {
    let isReturn = false
    let oldCaption = ''

    const intervalId = setInterval(async () => {
      let caption = ''

      const currentVideo = document.querySelector("[id^='playerId__'] video")

      // 読み込み時とビデオIDが変わった場合
      if (currentVideo !== null && currentVideo.id !== videoId) {
        clearInterval(intervalId)
        resolve(CHANGE_VIDEO_ID_MESSAGE)
        isReturn = true
      }
      if (isReturn) return

      // 字幕読み上げの設定値
      const result = await getStorage().then(
        (result) => result,
        (error) => {
          clearInterval(intervalId)
          reject(error)
          isReturn = true
        }
      )
      if (isReturn) return

      // 読み上げ機能をオフに設定している場合
      if (!result.isEnabledSpeak) {
        clearInterval(intervalId)
        resolve(DISABLE_MESSAGE)
        isReturn = true
      }
      if (isReturn) return

      // 監視対象の字幕を含むエレメントを取得する
      const TARGET_NODE1 =
        targetNode.getElementsByClassName(TARGET_CAPTION_NODE1)[0]
      const TARGET_NODE2 =
        targetNode.getElementsByClassName(TARGET_CAPTION_NODE2)[0]

      // エレメントから字幕を抽出する
      if (TARGET_NODE1 !== undefined && TARGET_NODE1.innerHTML !== '') {
        caption = TARGET_NODE1.innerHTML
      }
      if (TARGET_NODE2 !== undefined && TARGET_NODE2.innerHTML !== '') {
        caption = TARGET_NODE2.innerHTML
      }

      // 抽出した字幕がまだ読み上げていないものだった場合
      if (
        caption !== '' &&
        caption !== '&amp;nbsp;' &&
        oldCaption !== caption
      ) {
        if (result.isEnabledTranslation) {
          const sourceLanguage = 'en' // todo: 字幕の言語を設定値から取得する
          const targetLanguage = 'ja' // todo: 字幕の言語を設定値から取得する
          const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(
            caption
          )}`
          const translated = await translateText(apiUrl)
          if (translated !== undefined && oldCaption !== translated) {
            captions.push(translated)
          }
        } else {
          captions.push(caption)
        }
        oldCaption = caption
      }

      // 読上リストが溜まっている場合
      if (5 < captions.length) {
        currentVideo.pause() // 再生中のビデオを停止する
        alert(SKIP_MESSAGE)
        clearInterval(intervalId)
        resolve(DISABLE_MESSAGE)
        return
      }

      // 発話しておらず字幕リストが空でもない場合
      if (synth.speaking === false && captions.length !== 0) {
        // 字幕テキスト
        const textContent = captions[0]
        const speech = new SpeechSynthesisUtterance(textContent)
        speech.lang = 'ja-JP' // todo: 設定値から取得する
        speech.volume = result.utteranceVolume
        speech.rate = result.utteranceRate
        speech.voice = voices[result.utteranceVoiceType]
        synth.speak(speech)

        speech.onend = () => {
          captions.shift()
        }

        speech.onerror = () => {
          clearInterval(intervalId)
          reject('speechClosedCaption:\n' + ERROR_MESSAGE)
        }
      }
    }, 500)
  })
}

async function sendHttpRequest(url) {
  const response = await fetch(url)
  return await response.json()
}

async function translateText(apiUrl) {
  const response = await sendHttpRequest(apiUrl)
  const translatedText = response[0][0][0]
  console.log(translatedText) // todo: 画面に表示するようにする
  return translatedText
}
