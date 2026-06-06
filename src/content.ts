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
const ENABLE_MESSAGE = 'Currently, Udemy translate & speaker is enable.'
const DISABLE_MESSAGE = 'Currently, Udemy translate & speaker is disable.'
const CHANGE_VIDEO_ID_MESSAGE = 'The Video Id has been changed.'

// Selectores elásticos para soportar actualizaciones de Udemy
const TARGET_CONTAINER_SELECTOR = '[class*="video-player-module--"]'
const TARGET_VIDEO_SELECTOR = 'video'

const CAPTION_SELECTOR_BY_PURPOSE = '[data-purpose="captions-cue-text"]'
const CAPTION_SELECTOR_LEGACY = '[class*="captions-display-module--"]'

const start = async () => {
  synth.cancel() // バグ対策
  synth.pause() // 初期表示時は喋らない

  await reStart()
}
window.onload = start

const reStart = async () => {
  // Buscamos directamente la etiqueta nativa de video
  const video: any = document.querySelector(TARGET_VIDEO_SELECTOR)

  if (!video) {
    // Si no carga de inmediato, esperamos un breve momento y reintentamos
    setTimeout(reStart, 1000)
    return
  }

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
  captionDiv.id = 'captionDiv'
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

    chrome.storage.local.set({ isEnabledTranslation: newTranslationState })

    if (newTranslationState) {
      captionDiv.style.border = '2px solid #4CAF50' // 緑色：翻訳ON
      setTimeout(() => { captionDiv.style.border = 'none' }, 1000)
    } else {
      captionDiv.style.border = '2px solid #f44336' // 赤色：翻訳OFF  
      setTimeout(() => { captionDiv.style.border = 'none' }, 1000)
    }
  })

  video.onplay = () => synth?.resume()
  const videoId = video.id || 'udemy-video-active'

  // Buscamos el contenedor principal usando el nuevo selector adaptado
  const videoPlayer = document.querySelector(TARGET_CONTAINER_SELECTOR) || video.parentNode
  captions = []

  await observeCaption(videoPlayer, videoId)

  try {
    await checkStatus()
    await reStart()
  } catch (error) {
    console.error('Error in reStart:', error)
  }
}

/**
 * Web Speech API の使用可能な合成音声を取得
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
 */
async function checkStatus() {
  return new Promise((resolve, reject) => {
    let attemptCount = 0
    const maxAttempts = 20

    const intervalId = setInterval(async () => {
      attemptCount++
      try {
        const result: any = await getStorage()
        if (result !== undefined && result?.isEnabledSpeak === true) {
          clearInterval(intervalId)
          resolve(ENABLE_MESSAGE)
        } else if (attemptCount >= maxAttempts) {
          clearInterval(intervalId)
          resolve(DISABLE_MESSAGE)
        }
      } catch (error) {
        clearInterval(intervalId)
        reject(error)
      }
    }, 500)
  })
}

/**
 * ブラウザ（アカウント）ストレージに保存した設定値などを取得する
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
 * 字幕を監視する、読み上げる
 */
function observeCaption(targetNode: any, videoId: any) {
  if (synth === undefined) throw new Error('SpeechSynthesis is not available.')

  return new Promise(async (resolve, reject) => {
    let oldCaption = ''
    let isAutoPause = false

    const intervalId = setInterval(async () => {
      let caption = ''

      // 1. Detección directa del elemento <video>
      const currentVideo: any | null = document.querySelector('video')
      if (currentVideo === null) {
        throw new Error('currentVideo is null')
      }

      // ⚠️ Validación de cambio de video
      if (currentVideo?.id !== videoId && videoId !== 'udemy-video-active') {
        clearInterval(intervalId)
        resolve(CHANGE_VIDEO_ID_MESSAGE)
        return
      }

      // 読み上げ機能をオフに設定している場合、監視を終了する
      const result: any = await getStorage()
      if (!result.isEnabledSpeak) {
        document.getElementById('captionDiv')?.remove()
        clearInterval(intervalId)
        resolve(DISABLE_MESSAGE)
        return
      }

      // 2. Extracción limpia y unificada del subtítulo actual
      let captionElement = document.querySelector(CAPTION_SELECTOR_BY_PURPOSE)
      if (!captionElement) {
        captionElement = document.querySelector(CAPTION_SELECTOR_LEGACY)
      }

      if (captionElement && captionElement.innerHTML !== '') {
        caption = captionElement.innerHTML
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
            .replace(/\? /g, '?')
          const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(
            editedCaption
          )}`
          const translated = await translateText(apiUrl)
          if (translated !== undefined) {
            captions.push(translated)
          }
        } else {
          captions.push(caption)
        }
      }

      // POR ESTA SOLUCIÓN SILENCIOSA Y SIN ALERTS:
      if (captions.length > 6) {
        if (!currentVideo?.paused) {
          currentVideo.pause()
          isAutoPause = true
        }
        synth.resume() // Mantiene activo el motor de TTS si se llega a congelar
      }

      // 発話しておらず字幕リストが空でもない場合
      if (!synth.speaking && captions.length !== 0 && !currentVideo?.paused) {
        const textContent = captions[0]
        const speech = new SpeechSynthesisUtterance(textContent)
        const targetLang: any = LANGUAGES.find(
          (language: any) => language.translate === result.translateTo
        )
        speech.lang = targetLang.speak
        speech.volume = result.utteranceVolume
        //Sincronización dinámica de velocidad:
        // Multiplica tu velocidad base (1.2x) por la velocidad del reproductor de Udemy (1.25x)
        const baseRate = result.utteranceRate || 1.0
        const udemySpeed = currentVideo.playbackRate || 1.0
        speech.rate = baseRate * udemySpeed
        const voices: any = await getVoices()
        speech.voice = voices[result.utteranceVoiceType]
        speech.onstart = () => {
          if (captions.length <= 1) {
            if (isAutoPause) {
              currentVideo.play()
              isAutoPause = false
            }
          }

          const captionDiv: HTMLElement | null =
            document.getElementById('captionDiv')
          if (captionDiv !== null) {
          //Verificar si la visualización de captions está habilitada
            if (result.isEnabledDisplayCaptions !== false) {
              captionDiv.innerHTML = speech.text
              const fontSize = result.captionFontSize || 1.5
              captionDiv.style.fontSize = fontSize + 'em'

              const translationIndicator = result.isEnabledTranslation ? '🌐' : '📝'
              captionDiv.setAttribute('data-translation', result.isEnabledTranslation ? 'on' : 'off')
              captionDiv.innerHTML = `<span style="font-size: 0.8em; opacity: 0.7; position: absolute; top: -20px; left: 0;">${translationIndicator}</span>` + speech.text
            } else {
              // Si los captions están deshabilitados, limpiar el contenido del captionDiv
              captionDiv.innerHTML = ''
            }
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

      if (captions.length >= 6) {
        if (!currentVideo?.paused) {
          currentVideo.pause('isAutoPause')
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
    return undefined
  }
}