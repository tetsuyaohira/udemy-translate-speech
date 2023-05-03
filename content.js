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

const LANGUAGES = [
  {
    translate: 'de',
    speak: 'de-DE',
  },
  {
    translate: 'fr',
    speak: 'fr-FR',
  },
  {
    translate: 'it',
    speak: 'it-IT',
  },
  {
    translate: 'ja',
    speak: 'ja-JP',
  },
  {
    translate: 'ko',
    speak: 'ko-KR',
  },
  {
    translate: 'ru',
    speak: 'ru-RU',
  },
]

const start = async () => {
  synth.cancel() // バグ対策
  synth.pause() // 初期表示時は喋らない

  await reStart()
}
window.onload = start

const reStart = async () => {
  const voices = await getVoices()

  // 合成音声をストレージに保存
  let utteranceVoiceList = voices.map((voice) => voice.name)
  chrome.storage.local.set({ utteranceVoiceList })

  // ビデオを監視
  const video = await getElementByClassName(TARGET_VIDEO_NODE)
  video.onplay = () => synth.resume()
  const videoId = video.id
  await observeVideo(videoId)

  // 字幕を監視
  const videoPlayer = await getElementByClassName(TARGET_CONTAINER_NODE)
  await observeCaption(videoPlayer, voices, videoId)

  // 読み上げ機能オンオフを監視
  await checkStatus()
  captions = []
  await reStart()
}

/**
 * Web Speech API の使用可能な合成音声を取得
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
async function getVoices() {
  const voices = synth.getVoices()
  if (voices.length === 0) throw Error(UNAVAILABLE_MESSAGE)
  const result = await getStorage()
  const targetLang = LANGUAGES.find(
    (language) => language.translate === result.translateTo
  )
  return voices.filter((voice) => voice.lang === targetLang.speak)
}

/**
 * 読み上げ機能オンオフを確認する
 * @returns {string}
 */
async function checkStatus() {
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async () => {
      const result = await getStorage()
      if (result !== undefined && result.isEnabledSpeak === true) {
        clearInterval(intervalId)
        resolve(ENABLE_MESSAGE)
      }
    }, 500)
  })
}

/**
 * クラス属性名をもとにエレメントを取得する
 * @param {string} className
 * @returns {Promise<HTMLVideoElement>} elements
 */
async function getElementByClassName(className) {
  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      const element = document.getElementsByClassName(className)[0]

      if (element !== undefined) {
        clearInterval(intervalId)
        resolve(element)
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
    let oldCaption = ''
    let isAutoPause = false

    const intervalId = setInterval(async () => {
      let caption = ''

      const currentVideo = document.querySelector("[id^='playerId__'] video")

      // 読み込み時とビデオIDが変わった場合
      if (currentVideo?.id !== videoId) {
        clearInterval(intervalId)
        resolve(CHANGE_VIDEO_ID_MESSAGE)
        return
      }

      // 読み上げ機能をオフに設定している場合、監視を終了する
      const result = await getStorage()
      if (!result.isEnabledSpeak) {
        clearInterval(intervalId)
        resolve(DISABLE_MESSAGE)
        return
      }

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
        oldCaption = caption
        if (result.isEnabledTranslation) {
          const sourceLanguage = 'en'
          const result = await getStorage()
          const targetLanguage = result.translateTo
          const editedCaption = caption
            .replace(/\. /g, '.')
            .replace(/\? /g, '?') // 文が複数あると後続の文が翻訳されないため、`. `を`.`に置き換えて全文が翻訳されるようにしている
          console.log(editedCaption)
          const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(
            editedCaption
          )}`
          const translated = await translateText(apiUrl)
          if (translated !== undefined && oldCaption !== translated) {
            captions.push(translated)
          }
        } else {
          captions.push(caption)
        }
      }

      // 読上リストが溜まっている場合
      if (5 < captions.length) {
        currentVideo.pause()
        synth.resume() // なぜか喋らなくなるバグ対応
        alert(SKIP_MESSAGE)
      }

      // 発話しておらず字幕リストが空でもない場合
      if (synth.speaking === false && captions.length !== 0) {
        // console.log('captions.length=' + captions.length)
        // console.log('isAutoPause=' + isAutoPause)
        // 字幕テキスト
        const textContent = captions[0]
        const speech = new SpeechSynthesisUtterance(textContent)
        const targetLang = LANGUAGES.find(
          (language) => language.translate === result.translateTo
        )
        speech.lang = targetLang.speak
        speech.volume = result.utteranceVolume
        speech.rate = result.utteranceRate
        speech.voice = voices[result.utteranceVoiceType]
        speech.onend = () => {
          captions.shift()
          if (captions.length >= 2) {
            // 読上リストが溜まっている場合
            currentVideo.pause()
            isAutoPause = true
          } else {
            if (isAutoPause) {
              // Scriptが読み上げを一時停止させた場合、再生を再開する
              currentVideo.play()
              isAutoPause = false
            }
          }
        }
        speech.onerror = () => {
          clearInterval(intervalId)
          reject('Speech Caption:\n' + ERROR_MESSAGE)
        }
        synth.speak(speech)
      }
    }, 100)
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
