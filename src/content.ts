'use strict'

import { LANGUAGES } from './utils/languages'

chrome.storage.local.set({ userAgent: window.navigator.userAgent })

let captions: any[] = [] // 字幕リスト
const synth: SpeechSynthesis | undefined =
  document?.defaultView?.speechSynthesis
if (synth === undefined) throw new Error('SpeechSynthesis is not available.')

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

const TARGET_CONTAINER_NODE = 'video-player--container--'
const TARGET_VIDEO_NODE = 'video-player--video-player--'
const TARGET_CAPTION_NODE1 = 'well--text--'
const TARGET_CAPTION_NODE2 = 'captions-display--captions-cue-text--'

const start = async () => {
  synth.cancel() // バグ対策
  synth.pause() // 初期表示時は喋らない

  await reStart()
}
window.onload = start

const reStart = async () => {
  const video: any = await getElementByClassName(TARGET_VIDEO_NODE)
  
  // 既存のseekイベントリスナーを削除（同じ関数参照を使う）
  const seekHandler = () => {
    captions = []
  }
  video.removeEventListener('seeked', seekHandler)
  video.addEventListener('seeked', seekHandler)

  // 既存のcaptionDivがあれば削除
  const existingCaptionDiv = document.getElementById('captionDiv')
  if (existingCaptionDiv) {
    existingCaptionDiv.remove()
  }

  // 字幕用のDiv要素を追加
  const captionDiv = document.createElement('div')
  captionDiv.id = 'captionDiv' // todo:idが２箇所以上で使われている
  captionDiv.className = 'captionDiv'
  
  // 初期フォントサイズを設定
  const result: any = await getStorage()
  const fontSize = result.captionFontSize || 1.5
  captionDiv.style.fontSize = fontSize + 'em'
  
  video.parentNode.appendChild(captionDiv)

  // 字幕用のDiv要素をドラッグで移動できるようにする
  captionDiv.addEventListener('mousedown', (e) => {
    const x = e.pageX - captionDiv.offsetLeft
    const y = e.pageY - captionDiv.offsetTop
    const moveHandler = (e: any) => {
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

  // 字幕エリアをダブルクリックで翻訳ON/OFF切り替え
  captionDiv.addEventListener('dblclick', async () => {
    const currentSettings: any = await getStorage()
    const newTranslationState = !currentSettings.isEnabledTranslation
    
    // 設定を更新
    chrome.storage.local.set({ isEnabledTranslation: newTranslationState })
    
    // 視覚的フィードバック：境界線の色を変更
    if (newTranslationState) {
      captionDiv.style.border = '2px solid #4CAF50' // 緑色：翻訳ON
      setTimeout(() => { captionDiv.style.border = 'none' }, 1000)
    } else {
      captionDiv.style.border = '2px solid #f44336' // 赤色：翻訳OFF  
      setTimeout(() => { captionDiv.style.border = 'none' }, 1000)
    }
  })

  video.onplay = () => synth?.resume()
  const videoId = video.id

  // await observeVideo(videoId) // ビデオが再生されるまで待機

  // 字幕を監視して、翻訳と読み上げを行う
  const videoPlayer = await getElementByClassName(TARGET_CONTAINER_NODE)
  captions = []
  await observeCaption(videoPlayer, videoId)

  try {
    await checkStatus() // 読み上げ機能オンオフを監視
    await reStart()
  } catch (error) {
    console.error('Error in reStart:', error)
    // エラー時は再起動せずに停止
  }
}

/**
 * Web Speech API の使用可能な合成音声を取得
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
async function getVoices() {
  const voices: SpeechSynthesisVoice[] | undefined = synth?.getVoices()
  if (voices?.length === 0) throw Error(UNAVAILABLE_MESSAGE)
  const result: any = await getStorage()
  const targetLang: any = LANGUAGES.find(
    (language: any) => language.translate === result.translateTo
  )
  return voices?.filter((voice) => voice.lang === targetLang.speak)
}

/**
 * 読み上げ機能オンオフを確認する
 * @returns {string}
 */
async function checkStatus() {
  return new Promise((resolve, reject) => {
    let attemptCount = 0
    const maxAttempts = 20 // 10秒でタイムアウト (500ms * 20)
    
    const intervalId = setInterval(async () => {
      attemptCount++
      try {
        const result: any = await getStorage()
        if (result !== undefined && result?.isEnabledSpeak === true) {
          clearInterval(intervalId)
          resolve(ENABLE_MESSAGE)
        } else if (attemptCount >= maxAttempts) {
          clearInterval(intervalId)
          resolve(DISABLE_MESSAGE) // タイムアウト時は無効として扱う
        }
      } catch (error) {
        clearInterval(intervalId)
        reject(error)
      }
    }, 500)
  })
}

/**
 * クラス属性名をもとにエレメントを取得する
 * @param {string} className
 * @returns {Promise<HTMLVideoElement>} elements
 */
async function getElementByClassName(className: string) {
  return new Promise((resolve, reject) => {
    let attemptCount = 0
    const maxAttempts = 60 // 30秒でタイムアウト (500ms * 60)
    
    const intervalId = setInterval(() => {
      attemptCount++
      const element = document.querySelectorAll(`[class^="${className}"]`)[0]

      if (element !== null && element !== undefined) {
        clearInterval(intervalId)
        resolve(element)
      } else if (attemptCount >= maxAttempts) {
        clearInterval(intervalId)
        reject(new Error(`Element with class ${className} not found after 30 seconds`))
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
function observeCaption(targetNode: any, videoId: any) {
  if (synth === undefined) throw new Error('SpeechSynthesis is not available.')

  return new Promise(async (resolve, reject) => {
    let oldCaption = ''
    let isAutoPause = false

    const intervalId = setInterval(async () => {
      let caption = ''

      const currentVideo: any | null = document.querySelector(
        "[id^='playerId__'] video"
      )
      if (currentVideo === null) {
        throw new Error('currentVideo is null')
      }

      // 読み込み時とビデオIDが変わった場合
      if (currentVideo?.id !== videoId) {
        clearInterval(intervalId)
        resolve(CHANGE_VIDEO_ID_MESSAGE)
        return
      }

      // 読み上げ機能をオフに設定している場合、監視を終了する
      const result: any = await getStorage()
      if (!result.isEnabledSpeak) {
        document.getElementById('captionDiv')?.remove() // 字幕表示用のDiv要素を削除
        clearInterval(intervalId)
        resolve(DISABLE_MESSAGE)
        return
      }

      // 監視対象の字幕を含むエレメントを取得する
      const TARGET_NODE1 = document.querySelectorAll(
        `[class^="${TARGET_CAPTION_NODE1}"]`
      )[0]

      const TARGET_NODE2 = document.querySelectorAll(
        `[class^="${TARGET_CAPTION_NODE2}"]`
      )[0]

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
          const result: any = await getStorage()
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
      // 動画が再生中の場合のみ音声合成を実行（not-allowedエラー対策）
      if (!synth.speaking && captions.length !== 0 && !currentVideo?.paused) {
        // 字幕テキスト
        const textContent = captions[0]
        const speech = new SpeechSynthesisUtterance(textContent)
        const targetLang: any = LANGUAGES.find(
          (language: any) => language.translate === result.translateTo
        )
        speech.lang = targetLang.speak
        speech.volume = result.utteranceVolume
        speech.rate = result.utteranceRate
        const voices: any = await getVoices()
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
          const captionDiv: HTMLElement | null =
            document.getElementById('captionDiv')
          if (captionDiv !== null) {
            captionDiv.innerHTML = speech.text
            // フォントサイズを適用
            const fontSize = result.captionFontSize || 1.5
            captionDiv.style.fontSize = fontSize + 'em'
            
            // 翻訳状態を視覚的に表示（左上にアイコン表示）
            const translationIndicator = result.isEnabledTranslation ? '🌐' : '📝'
            captionDiv.setAttribute('data-translation', result.isEnabledTranslation ? 'on' : 'off')
            captionDiv.innerHTML = `<span style="font-size: 0.8em; opacity: 0.7; position: absolute; top: -20px; left: 0;">${translationIndicator}</span>` + speech.text
          }
        }
        speech.onend = () => captions.shift()
        speech.onerror = (event) => {
          console.error('Speech synthesis error:', event)
          clearInterval(intervalId)
          reject('Speech Caption:\n' + ERROR_MESSAGE + '\nError: ' + event.error)
        }
        synth.speak(speech)
      }

      if (captions.length >= 2) {
        if (!currentVideo?.paused) {
          currentVideo.pause('isAutoPause') // 読上リストが溜まっている場合、動画再生をStop
          isAutoPause = true
        }
      }
    }, 100)
  })
}

async function sendHttpRequest(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Network request failed:', error)
    throw error
  }
}

async function translateText(apiUrl: string) {
  try {
    const response = await sendHttpRequest(apiUrl)
    return response[0][0][0]
  } catch (error) {
    console.error('Translation failed:', error)
    return undefined // 翻訳失敗時はundefinedを返す
  }
}
