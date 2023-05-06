'use strict'

const isEnabledSpeak = true
const isEnabledTranslation = true
const translateTo = 'ja'
const utteranceLang = 'ja-JP'
const utteranceVolume = 0.5
const utteranceRate = 3.5
const utteranceVoiceList = []
const utteranceVoiceType = 0
const userAgent = ''

chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.local.set({ isEnabledSpeak })
  chrome.storage.local.set({ isEnabledTranslation })
  chrome.storage.local.set({ translateTo })
  chrome.storage.local.set({ utteranceLang })
  chrome.storage.local.set({ utteranceVolume })
  chrome.storage.local.set({ utteranceRate })
  chrome.storage.local.set({ utteranceVoiceList })
  chrome.storage.local.set({ utteranceVoiceType })
  chrome.storage.local.set({ userAgent })
})
