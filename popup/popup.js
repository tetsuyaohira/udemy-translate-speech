'use strict'

constructor()

function constructor() {
  chrome.storage.local.get(
    [
      'isEnabledSpeak',
      'isEnabledTranslation',
      'translateTo',
      'utteranceVolume',
      'utteranceRate',
      'utteranceVoiceList',
      'utteranceVoiceType',
      'userAgent',
    ],
    (data) => {
      // translation ON/OFF
      const isEnabledTranslation = data.isEnabledTranslation
      const powerButtonSwitchTranslation = document.getElementById(
        'power-button-switch-translation'
      )
      powerButtonSwitchTranslation.checked = isEnabledTranslation
      powerButtonSwitchTranslation.addEventListener(
        'change',
        handleCheckboxChangeTranslation
      )

      // translation language
      const languageSelect = document.getElementById('translate-to')
      languageSelect.value = data.translateTo
      languageSelect.disabled = !isEnabledTranslation
      languageSelect.addEventListener('change', handleLanguageChange)

      // speak ON/OFF
      const isEnabledSpeak = data.isEnabledSpeak
      const powerButtonSwitchSpeak = document.getElementById(
        'power-button-switch-speak'
      )
      powerButtonSwitchSpeak.checked = isEnabledSpeak
      powerButtonSwitchSpeak.addEventListener(
        'change',
        handleCheckboxChangeSpeak
      )

      // volume
      const volumeSlider = document.getElementById('volume-slider')
      volumeSlider.value = data.utteranceVolume
      volumeSlider.disabled = !isEnabledSpeak
      volumeSlider.addEventListener('change', handleVolumeChange)

      // voice
      if (data.utteranceVoiceList.length !== 0) {
        createVoiceTypeElement(data)
        createRateElement(data)
      }
    }
  )
}

function createVoiceTypeElement(data) {
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
  data.utteranceVoiceList.forEach((voice, index) => {
    let option = document.createElement('option')
    option.value = index
    option.text = voice
    select.add(option)
  })
  select.id = 'voice-type-id'
  select.selectedIndex = data.utteranceVoiceType
  voiceType.appendChild(select)

  document
    .getElementById('power-on')
    .insertAdjacentElement('beforeend', containerVoices)

  if (!data.isEnabledSpeak) select.disabled = true
}

function createRateElement(data) {
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

  const rateSlider = document.createElement('input')
  rateSlider.id = 'rate-slider'
  rateSlider.type = 'range'
  rateSlider.min = rateValueMin
  rateSlider.step = rateValueStep
  rateSlider.value = rateValue
  rateSlider.max = rateValueMax
  rateSlider.addEventListener('change', handleRateChange)

  const item2 = document.createElement('div')
  item2.className = 'item2'
  item2.appendChild(rateSlider)
  rateOption.appendChild(item2)

  document
    .getElementById('power-on')
    .insertAdjacentElement('beforeend', containerRate)

  if (!data.isEnabledSpeak) rateSlider.disabled = true
}

function handleCheckboxChangeTranslation(event) {
  const isEnabledTranslation = event.target.checked
  chrome.storage.local.set({ isEnabledTranslation: isEnabledTranslation })

  const languageSelect = document.getElementById('translate-to')
  if (languageSelect !== null) languageSelect.disabled = !isEnabledTranslation
}
function handleLanguageChange(event) {
  const language = event.target.value
  chrome.storage.local.set({ translateTo: language })
}

function handleCheckboxChangeSpeak(event) {
  const isEnabledSpeak = event.target.checked
  chrome.storage.local.set({ isEnabledSpeak: isEnabledSpeak })

  const volumeSlider = document.getElementById('volume-slider')
  const rateSlider = document.getElementById('rate-slider')
  const voiceTypeId = document.getElementById('voice-type-id')
  if (volumeSlider !== null) volumeSlider.disabled = !isEnabledSpeak
  if (rateSlider !== null) rateSlider.disabled = !isEnabledSpeak
  if (voiceTypeId !== null) voiceTypeId.disabled = !isEnabledSpeak
}

function handleVolumeChange(event) {
  chrome.storage.local.set({ utteranceVolume: event.target.value })
}

function handleRateChange(event) {
  chrome.storage.local.set({ utteranceRate: event.target.value })
}

async function handleVoiceTypeChange(event) {
  chrome.storage.local.set({ utteranceVoiceType: event.target.value })

  let rateSlider = document.getElementById('rate-slider')
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
      const userAgent = await getUserAgent()
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
