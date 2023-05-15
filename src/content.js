'use strict'

import { LANGUAGES } from './utils/languages.js'

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
// const START_MESSAGE = 'Video playback has started.'
const ENABLE_MESSAGE = 'Currently, Udemy translate & speaker is enable.'
const DISABLE_MESSAGE = 'Currently, Udemy translate & speaker is disable.'
const CHANGE_VIDEO_ID_MESSAGE = 'The Video Id has been changed.'

const TARGET_CONTAINER_NODE = 'video-player--container--YDQRW' // <div class="video-player--container--YDQRW">
const TARGET_VIDEO_NODE = 'vjs-tech' // <video class="vjs-tech">
const TARGET_CAPTION_NODE1 = 'well--text--2H_p0' // <span class="well--text--2H_p0">
const TARGET_CAPTION_NODE2 = 'captions-display--captions-cue-text--ECkJu' // <div class="captions-display--captions-cue-text--ECkJu">

const start = async () => {
  synth.cancel() // バグ対策
  synth.pause() // 初期表示時は喋らない

  await reStart()
}
window.onload = start

const reStart = async () => {
  const video = await getElementByClassName(TARGET_VIDEO_NODE)
  video.addEventListener('seeked', () => {
    captions = []
  })

  // 字幕用のDiv要素を追加
  const captionDiv = document.createElement('div')
  captionDiv.id = 'captionDiv' // todo:idが２箇所以上で使われている
  captionDiv.className = 'captionDiv'
  video.parentNode.appendChild(captionDiv)

  // 字幕用のDiv要素をドラッグで移動できるようにする
  captionDiv.addEventListener('mousedown', (e) => {
    const x = e.pageX - captionDiv.offsetLeft
    const y = e.pageY - captionDiv.offsetTop
    const moveHandler = (e) => {
      // 要素をマウス座標に合わせて移動する
      captionDiv.style.left = e.pageX - x + 'px'
      captionDiv.style.top = e.pageY - y + 'px'
    }

    const upHandler = () => {
      document.removeEventListener('mousemove', moveHandler)
      document.removeEventListener('mouseup', upHandler)
    }

    document.addEventListener('mousemove', moveHandler)
    document.addEventListener('mouseup', upHandler)
  })

  video.onplay = () => synth.resume()
  const videoId = video.id

  // await observeVideo(videoId) // ビデオが再生されるまで待機

  // 字幕を監視して、翻訳と読み上げを行う
  const videoPlayer = await getElementByClassName(TARGET_CONTAINER_NODE)
  captions = []
  await observeCaption(videoPlayer, videoId)

  await checkStatus() // 読み上げ機能オンオフを監視

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

      if (element !== null && element !== undefined) {
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
// function observeVideo(videoId) {
//   return new Promise((resolve, reject) => {
//     const intervalId = setInterval(() => {
//       try {
//         const video = document.getElementById(videoId)
//
//         if (video !== null && video.paused === false) {
//           clearInterval(intervalId)
//           resolve(START_MESSAGE)
//         }
//       } catch {
//         clearInterval(intervalId)
//         reject('observeVideo:\n' + ERROR_MESSAGE)
//       }
//     }, 500)
//   })
// }

/**
 * 字幕を監視する、読み上げる
 * @param targetNode
 * @param videoId
 * @returns {Promise<unknown>}
 */
function observeCaption(targetNode, videoId) {
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
        document.getElementById('captionDiv')?.remove() // 字幕表示用のDiv要素を削除
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
          const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(
            editedCaption
          )}`
          const translated = await translateText(apiUrl)
          if (translated !== undefined) {
            // console.log('translated:' + translated)
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
        // 字幕テキスト
        const textContent = captions[0]
        const speech = new SpeechSynthesisUtterance(textContent)
        const targetLang = LANGUAGES.find(
          (language) => language.translate === result.translateTo
        )
        speech.lang = targetLang.speak
        speech.volume = result.utteranceVolume
        speech.rate = result.utteranceRate
        const voices = await getVoices()
        speech.voice = voices[result.utteranceVoiceType]
        speech.onstart = () => {
          // console.log('speech:' + speech.text)
          if (captions.length <= 1) {
            if (isAutoPause) {
              currentVideo.play() // 動画再生を再開
              isAutoPause = false
            }
          }

          // id=captionDiv要素に字幕を表示する
          const captionDiv = document.getElementById('captionDiv')
          captionDiv.innerHTML = speech.text
        }
        speech.onend = () => captions.shift()
        speech.onerror = () => {
          clearInterval(intervalId)
          reject('Speech Caption:\n' + ERROR_MESSAGE)
        }
        synth.speak(speech)
      }

      if (captions.length >= 2) {
        if (!currentVideo.paused) {
          currentVideo.pause('isAutoPause') // 読上リストが溜まっている場合、動画再生をStop
          isAutoPause = true
        }
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
  return response[0][0][0]
}
