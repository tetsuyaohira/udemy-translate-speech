'use strict'
const synth: SpeechSynthesis | undefined =
  document?.defaultView?.speechSynthesis
if (synth === undefined) throw new Error('SpeechSynthesis is not available.')

import { LANGUAGES } from '../utils/languages'

constructor()

const getUtteranceVoiceList = async (utteranceLang: any) => {
  return synth
    .getVoices()
    .filter((voice) => voice.lang === utteranceLang)
    .map((voice) => {
      return voice.name
    })
}

const getUtteranceLang = (lang: any) => {
  // @ts-ignore
  return LANGUAGES.find((language) => language.translate === lang).speak
}

const getTranslateLang = (speak: string) => {
  // @ts-ignore
  return LANGUAGES.find((language) => language.speak === speak).translate
}

async function constructor() {
  chrome.storage.local.get(
    [
      'isEnabledSpeak',
      'isEnabledTranslation',
      'translateTo',
      'utteranceLang',
      'utteranceVolume',
      'utteranceRate',
      'utteranceVoiceList',
      'utteranceVoiceType',
      'userAgent',
      'captionFontSize',
    ],
    async (data) => {
      const utteranceVoiceList = await getUtteranceVoiceList(data.utteranceLang)
      await chrome.storage.local.set({ utteranceVoiceList })

      // translation ON/OFF
      const isEnabledTranslation = data.isEnabledTranslation
      const powerButtonSwitchTranslation: any = document.getElementById(
        'power-button-switch-translation'
      )
      if (powerButtonSwitchTranslation === null)
        throw new Error('powerButtonSwitchTranslation is null')
      powerButtonSwitchTranslation.checked = isEnabledTranslation
      powerButtonSwitchTranslation.addEventListener(
        'change',
        handleCheckboxChangeTranslation
      )

      // translation language
      const languageSelect: any = document.getElementById('translate-to')
      if (languageSelect === null) throw new Error('languageSelect is null')
      languageSelect.value = data.utteranceLang
      languageSelect.disabled = !isEnabledTranslation
      languageSelect.addEventListener('change', handleLanguageChange)

      // speak ON/OFF
      const isEnabledSpeak = data.isEnabledSpeak
      const powerButtonSwitchSpeak: any = document.getElementById(
        'power-button-switch-speak'
      )
      if (powerButtonSwitchSpeak === null)
        throw new Error('powerButtonSwitchSpeak is null')
      powerButtonSwitchSpeak.checked = isEnabledSpeak
      powerButtonSwitchSpeak.addEventListener(
        'change',
        handleCheckboxChangeSpeak
      )

      // volume
      const volumeSlider: any = document.getElementById('volume-slider')
      if (volumeSlider === null) throw new Error('volumeSlider is null')
      const volumeValue: any = document.getElementById('volume-value')
      volumeSlider.value = data.utteranceVolume
      volumeValue.textContent = data.utteranceVolume
      volumeSlider.disabled = !isEnabledSpeak
      volumeSlider.addEventListener('input', handleVolumeChange)

      // font size
      const fontSizeSlider: any = document.getElementById('font-size-slider')
      if (fontSizeSlider === null) throw new Error('fontSizeSlider is null')
      const fontSizeValue: any = document.getElementById('font-size-value')
      const currentFontSize = data.captionFontSize || 1.5
      fontSizeSlider.value = currentFontSize
      fontSizeValue.textContent = currentFontSize + 'x'
      fontSizeSlider.addEventListener('input', handleFontSizeChange)
      fontSizeSlider.disabled = !isEnabledSpeak

      // voice
      if (utteranceVoiceList.length !== 0) {
        createVoiceTypeElement({
          utteranceVoiceList,
          utteranceVoiceType: data.utteranceVoiceType,
          isEnabledSpeak,
        })
        createRateElement({
          utteranceVoiceList,
          utteranceRate: data.utteranceRate,
          isEnabledSpeak,
          utteranceVoiceType: data.utteranceVoiceType,
          userAgent: data.userAgent,
        })
      }
    }
  )
}

function createVoiceTypeElement(data: any) {
  // id="container-voices"の要素が存在すれば削除
  const oldContainerVoices = document.getElementById('container-voices')
  if (oldContainerVoices) oldContainerVoices.remove()

  // @ts-ignore
  document.getElementById('widget').style.height = 280 + 'px'

  const containerVoices = document.createElement('div')
  containerVoices.id = 'container-voices'
  containerVoices.className = 'container-voices'

  const voicesTitle = document.createElement('p')
  voicesTitle.id = 'container-voices-title'
  voicesTitle.className = 'container-voices-title'
  voicesTitle.innerHTML = 'Voice'
  containerVoices.appendChild(voicesTitle)

  const voicesOption = document.createElement('div')
  voicesOption.id = 'container-voices-option'
  containerVoices.appendChild(voicesOption)

  const voiceType = document.createElement('div')
  voiceType.className = 'item'
  voiceType.id = 'voice-type'
  voiceType.addEventListener('change', handleVoiceTypeChange)
  voicesOption.appendChild(voiceType)

  const select = document.createElement('select')
  data.utteranceVoiceList.forEach((voice: any, index: number) => {
    let option: any = document.createElement('option')
    option.value = index
    option.text = voice
    select.add(option)
  })
  select.id = 'voice-type-id'
  select.selectedIndex = data.utteranceVoiceType
  voiceType.appendChild(select)

  // @ts-ignore
  document
    .getElementById('power-on')
    .insertAdjacentElement('beforeend', containerVoices)

  if (!data.isEnabledSpeak) select.disabled = true
}

function createRateElement(data: any) {
  const oldContainerRate = document.getElementById('container-rate')
  if (oldContainerRate) oldContainerRate.remove()

  // @ts-ignore
  document.getElementById('widget').style.height = 495 + 'px'

  let rateValue = data.utteranceRate
  let rateValueMin = 2
  let rateValueMax = 8
  let rateValueStep = 1.5

  const isEdge = data.userAgent.toLowerCase().indexOf('edg') !== -1
  if (isEdge) {
    if (3 < rateValue) {
      rateValue = 2
      chrome.storage.local.set({ utteranceRate: rateValue })
    }
    rateValueMin = 1
    rateValueMax = 3
    rateValueStep = 0.5
  }

  const voiceList = data.utteranceVoiceList
  const voiceType = data.utteranceVoiceType
  if (
    (voiceList[voiceType] !== undefined &&
      voiceList[voiceType].indexOf('Google') !== -1) ||
    (voiceList[voiceType] !== undefined &&
      voiceList[voiceType].indexOf('Kyoko') !== -1)
  ) {
    /* Google または Kyoko が選択されている場合 */
    rateValueMin = 1
    rateValueMax = 2
    rateValueStep = 0.1
  }

  const containerRate = document.createElement('div')
  containerRate.id = 'container-rate'
  containerRate.className = 'container-rate'

  const rateTitle = document.createElement('p')
  rateTitle.id = 'container-rate-title'
  rateTitle.className = 'container-rate-title'
  rateTitle.innerHTML = 'Speed'
  containerRate.appendChild(rateTitle)

  const rateOption = document.createElement('div')
  rateOption.id = 'container-rate-option'
  rateOption.className = 'container-rate-option'
  containerRate.appendChild(rateOption)

  const rateSlider: any = document.createElement('input')
  rateSlider.id = 'rate-slider'
  rateSlider.type = 'range'
  rateSlider.min = rateValueMin
  rateSlider.step = rateValueStep
  rateSlider.value = rateValue
  rateSlider.max = rateValueMax
  rateSlider.addEventListener('input', handleRateChange)

  const rateValueSpan = document.createElement('span')
  rateValueSpan.id = 'rate-value'
  rateValueSpan.style.marginLeft = '10px'
  rateValueSpan.textContent = rateValue + 'x'

  const item2 = document.createElement('div')
  item2.className = 'item2'
  item2.appendChild(rateSlider)
  item2.appendChild(rateValueSpan)
  rateOption.appendChild(item2)

  // @ts-ignore
  document
    .getElementById('power-on')
    .insertAdjacentElement('beforeend', containerRate)

  if (!data.isEnabledSpeak) rateSlider.disabled = true
}

function handleCheckboxChangeTranslation(event: any) {
  const isEnabledTranslation = event.target.checked
  chrome.storage.local.set({ isEnabledTranslation: isEnabledTranslation })

  const languageSelect: any = document.getElementById('translate-to')
  if (languageSelect !== null) languageSelect.disabled = !isEnabledTranslation
}

async function handleLanguageChange(event: any) {
  chrome.storage.local.get(
    [
      'isEnabledSpeak',
      'translateTo',
      'utteranceLang',
      'utteranceVolume',
      'utteranceRate',
      'utteranceVoiceList',
      'utteranceVoiceType',
      'userAgent',
    ],
    async (data) => {
      const utteranceLang = event.target.value
      await chrome.storage.local.set({ utteranceLang })
      const translateTo = getTranslateLang(utteranceLang)
      await chrome.storage.local.set({ translateTo })

      const utteranceVoiceList = await getUtteranceVoiceList(utteranceLang)
      await chrome.storage.local.set({ utteranceVoiceList })

      createVoiceTypeElement({
        utteranceVoiceList,
        utteranceVoiceType: 0,
        isEnabledSpeak: data.isEnabledSpeak,
      })
      createRateElement({
        utteranceVoiceList,
        utteranceRate: data.utteranceRate,
        isEnabledSpeak: data.isEnabledSpeak,
        utteranceVoiceType: data.utteranceVoiceType,
        userAgent: data.userAgent,
      })
    }
  )
}

function handleCheckboxChangeSpeak(event: any) {
  const isEnabledSpeak = event.target.checked
  chrome.storage.local.set({ isEnabledSpeak: isEnabledSpeak })

  const volumeSlider: any = document.getElementById('volume-slider')
  const rateSlider: any = document.getElementById('rate-slider')
  const voiceTypeId: any = document.getElementById('voice-type-id')
  const fontSizeSlider: any = document.getElementById('font-size-slider')
  if (volumeSlider !== null) volumeSlider.disabled = !isEnabledSpeak
  if (rateSlider !== null) rateSlider.disabled = !isEnabledSpeak
  if (voiceTypeId !== null) voiceTypeId.disabled = !isEnabledSpeak
  if (fontSizeSlider !== null) fontSizeSlider.disabled = !isEnabledSpeak
}

function handleVolumeChange(event: any) {
  const volume = event.target.value
  chrome.storage.local.set({ utteranceVolume: volume })
  const volumeValue: any = document.getElementById('volume-value')
  if (volumeValue) {
    volumeValue.textContent = volume
  }
}

function handleFontSizeChange(event: any) {
  const fontSize = event.target.value
  chrome.storage.local.set({ captionFontSize: fontSize })
  const fontSizeValue: any = document.getElementById('font-size-value')
  if (fontSizeValue) {
    fontSizeValue.textContent = fontSize + 'x'
  }
}

function handleRateChange(event: any) {
  const rate = event.target.value
  chrome.storage.local.set({ utteranceRate: rate })
  const rateValue: any = document.getElementById('rate-value')
  if (rateValue) {
    rateValue.textContent = rate + 'x'
  }
}

async function handleVoiceTypeChange(event: any) {
  chrome.storage.local.set({ utteranceVoiceType: event.target.value })

  let rateSlider: any = document.getElementById('rate-slider')
  const voiceTypeText = event.target.options[event.target.value].textContent
  if (voiceTypeText !== undefined) {
    if (
      voiceTypeText.indexOf('Google') !== -1 ||
      voiceTypeText.indexOf('Kyoko') !== -1
    ) {
      /* Google または Kyoko が選択された場合 */
      rateSlider.min = 1
      rateSlider.step = 0.1
      rateSlider.value = 1.5
      rateSlider.max = 2
      chrome.storage.local.set({ utteranceRate: rateSlider.value })
    } else {
      /* Google または Kyoko 以外が選択された場合 */
      const userAgent: any = await getUserAgent()
      if (!userAgent) return
      const isEdge = userAgent.toLowerCase().indexOf('edg') !== -1
      if (isEdge) {
        rateSlider.min = 1
        rateSlider.max = 3
        rateSlider.step = 0.5
      } else {
        rateSlider.max = 8
        rateSlider.step = 1.5
        if (rateSlider.value < 2) {
          rateSlider.value = 3.5

          chrome.storage.local.set({ utteranceRate: rateSlider.value })
        }
        rateSlider.min = 2
      }
    }
  }
}

function getUserAgent() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['userAgent'], (data) => {
      resolve(data.userAgent)
    })
  })
}
