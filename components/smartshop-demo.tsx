'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, AudioLines, Check, ChevronRight, CircleHelp, Crosshair, Headphones, Home, Mic, Package, Search, ShoppingBag, ShoppingBasket, Sparkles, Store, Truck, Volume2, X } from 'lucide-react'

type Screen = 'guide-choice' | 'home' | 'voice' | 'product' | 'basket' | 'delivery' | 'payment' | 'review' | 'confirmation' | 'tracking' | 'shop'
type Flow = 'A · First-time buyer' | 'B · Returning buyer' | 'C · Shop side'
type DeliveryLocation = { latitude: number; longitude: number }

const labels: Record<Screen, string> = { 'guide-choice':'Meet Sami', home:'Home · Guided', voice:'Listen-to-Shop', product:'Product · Guided', basket:'Basket · Guided', delivery:'06 · Delivery', payment:'07 · Payment', review:'08 · Review', confirmation:'09 · Confirmation', tracking:'10a · Order journey', shop:'Shop console' }

const samiPoses = {
  parcel:'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/sami-parcel-ozDlqPAO3pvhtPrdnFXfCTUEdjjxAR.png',
  basket:'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/sami-basket-hwmUylaMR7OAjoxerqvtkdm4TEIHZW.png',
  wave:'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/sami-wave-OAhxBCqYwB6vIAK6r2oHBJlCEoirGI.png',
  point:'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/sami-point-IvEyPN9t04p3LQ2VmdCjgSwi2e47RH.png',
}

type SamiPose = keyof typeof samiPoses

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechRecognitionWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }

const voiceSamples: Record<string, string> = {
  English:'Hi, I’m Sami. What are you looking for today?',
  Français:'Bonjour, que cherchez-vous aujourd’hui ?',
  عربي:'مرحباً، ماذا تبحث عنه اليوم؟',
}

const deliveryGuideNarration = 'Let me help your order find its way to you. Share your full name, phone, and delivery location. Not sure where you are? Tap “Use my current location” and I’ll find you. Check your details before continuing—you can still change them until your order is on the road.'

const journeyStops = [
  { title:'Order received', icon:Store },
  { title:'Shop said yes', icon:Check },
  { title:'Packed with care', icon:Package },
  { title:'On the road', icon:Truck },
  { title:'At your door', icon:Home },
]

const products = [
  { name:'Cotton T-shirt', price:45, detail:'Soft, everyday cotton', image:'/product-tee.png', color:'Black', fabric:'100% cotton' },
  { name:'Linen shirt', price:85, detail:'Light and breathable', image:'/product-linen.png', color:'Ivory', fabric:'Natural linen' },
  { name:'Everyday denim', price:110, detail:'An easy, relaxed fit', image:'/product-denim.png', color:'Indigo', fabric:'Soft denim' },
  { name:'Weekend sweatshirt', price:95, detail:'A little extra comfort', image:'/product-sweater.png', color:'Rose', fabric:'Brushed cotton' },
]

export function SmartShopDemo() {
  const [screen, setScreen] = useState<Screen>('guide-choice')
  const [flow, setFlow] = useState<Flow>('A · First-time buyer')
  const [overlay, setOverlay] = useState('')
  const [cart, setCart] = useState(0)
  const [spoken, setSpoken] = useState(false)
  const [guideEnabled, setGuideEnabled] = useState(true)
  const [listenToShop, setListenToShop] = useState(false)
  const speechRequestRef = useRef<SpeechSynthesisUtterance | null>(null)
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [speechCaption, setSpeechCaption] = useState('')
  const [language, setLanguage] = useState('English')
  const [voiceInput, setVoiceInput] = useState('')
  const [voiceReply, setVoiceReply] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [size, setSize] = useState('M')
  const [selectedProduct, setSelectedProduct] = useState(products[0])
  const [deliveryAddress, setDeliveryAddress] = useState('12 Rue de la République')
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [trackingStep, setTrackingStep] = useState(1)
  const [heightInput, setHeightInput] = useState('168')
  const [fitPreference, setFitPreference] = useState<'Closer' | 'Relaxed'>('Relaxed')
  const heightCm = Math.min(205, Math.max(140, Number(heightInput) || 168))
  const baseSize = heightCm < 158 ? 0 : heightCm < 176 ? 1 : 2
  const recommendedSize = ['S', 'M', 'L'][baseSize]

  const addToCart = () => { setCart((n) => n + 1); setOverlay('Added to your basket') }
  const nav = (target: Screen) => go(target)
  const title = labels[screen]
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const filteredProducts = products.filter((product) => [product.name, product.detail, product.color, product.fabric].some((value) => value.toLowerCase().includes(normalizedSearchQuery)))
  const trackingMessage = trackingStep === 0 ? 'Your order is in. I’ll stay right here with you.' : trackingStep === 1 ? `Good news! The shop confirmed. They’re preparing your ${selectedProduct.name}.` : trackingStep === 2 ? 'All wrapped up. Your parcel is getting ready to leave.' : trackingStep === 3 ? 'I’m on the road with your parcel. Nearly there!' : 'I made it! Your parcel is at your door.'
  const currentVoiceMessage = voiceReply || voiceSamples[language]
  const voiceLocale = language === 'Français' ? 'fr-FR' : language === 'عربي' ? 'ar-TN' : 'en-US'

  const stopSpeaking = () => {
    speechRequestRef.current = null
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setSpoken(false)
  }

  const speak = (text: string, locale = 'en-US') => {
    setSpeechCaption(text)
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechCaption(`${text} Read-aloud is not available in this browser.`)
      return
    }
    window.speechSynthesis.cancel()
    speechRequestRef.current = null
    setSpoken(false)
    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find((candidate) => candidate.lang.toLowerCase() === locale.toLowerCase()) ?? voices.find((candidate) => candidate.lang.toLowerCase().startsWith(`${locale.split('-')[0].toLowerCase()}-`))
    if (locale !== 'en-US' && !voice) {
      const languageName = locale.startsWith('ar') ? 'Arabic' : 'French'
      setSpeechCaption(`${text} ${languageName} speech is unavailable on this device. Captions remain available.`)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = locale
    if (voice) utterance.voice = voice
    speechRequestRef.current = utterance
    setSpoken(true)
    const finish = () => {
      if (speechRequestRef.current !== utterance) return
      speechRequestRef.current = null
      setSpoken(false)
    }
    utterance.onstart = () => { if (speechRequestRef.current === utterance) setSpoken(true) }
    utterance.onend = finish
    utterance.onerror = finish
    window.speechSynthesis.speak(utterance)
  }

  const stopVoiceInput = () => {
    const recognition = speechRecognitionRef.current
    speechRecognitionRef.current = null
    recognition?.stop()
    setIsListening(false)
  }

  const startVoiceInput = () => {
    if (speechRecognitionRef.current) { stopVoiceInput(); return }
    const SpeechRecognition = (window as SpeechRecognitionWindow).SpeechRecognition ?? (window as SpeechRecognitionWindow).webkitSpeechRecognition
    if (!SpeechRecognition) { setVoiceError('Voice input is not available here. Type to Sami instead.'); return }
    setVoiceError('')
    setVoiceInput('')
    const recognition = new SpeechRecognition()
    recognition.lang = voiceLocale
    recognition.interimResults = true
    recognition.onresult = (event) => setVoiceInput(Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(''))
    recognition.onerror = () => { setVoiceError('I couldn’t hear that. Try again or type instead.'); setIsListening(false); speechRecognitionRef.current = null }
    recognition.onend = () => { setIsListening(false); if (speechRecognitionRef.current === recognition) speechRecognitionRef.current = null }
    speechRecognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }

  const sendVoiceMessage = () => {
    if (!voiceInput.trim()) return
    stopVoiceInput()
    setVoiceInput('')
    setVoiceError('')
    setVoiceReply('I heard you. Let’s find something together.')
  }

  useEffect(() => () => { speechRequestRef.current = null; speechRecognitionRef.current?.abort(); window.speechSynthesis?.cancel() }, [])

  useEffect(() => {
    if (!listenToShop) return
    const narration: Partial<Record<Screen, string>> = {
      'guide-choice': 'Hi, I’m Sami, your shop guide. Choose how you would like me to help.',
      home: guideEnabled ? 'Welcome to the shop. I can help you find something that feels right.' : 'Welcome to the shop. Take a look around at your own pace.',
      voice: currentVoiceMessage,
      product: `${selectedProduct.name}. ${selectedProduct.detail}. ${selectedProduct.price} Tunisian dinars. Pay when it arrives.`,
      basket: 'Your basket is safe. Nothing is ordered until you say so.',
      delivery: deliveryGuideNarration,
      payment: 'You can pay with cash when your parcel arrives. No bank card is needed.',
      review: 'Here is one last look at your order. You will not be charged now.',
      confirmation: 'Your order is received. The shop will call before your parcel is sent.',
      tracking: trackingMessage,
      shop: 'Welcome to the shop console. Here is the order awaiting confirmation.',
    }
    const text = narration[screen]
    if (text) speak(text, screen === 'voice' ? voiceLocale : 'en-US')
  }, [screen, listenToShop, guideEnabled, currentVoiceMessage, selectedProduct, trackingMessage, voiceLocale])

  const go = (next: Screen) => { stopVoiceInput(); if (next !== screen) { stopSpeaking(); setSpeechCaption('') } setOverlay(''); setScreen(next) }
  const resetFlow = (next: Flow) => { stopSpeaking(); setSpeechCaption(''); setFlow(next); setOverlay(''); setScreen(next.startsWith('A') ? 'guide-choice' : next.startsWith('B') ? 'home' : 'shop') }

  return <main className="demo-shell">
    <header className="topbar"><a className="wordmark" href="#home" onClick={(e) => {e.preventDefault(); go('home')}}><span className="brand-mark">s.</span> smartshop <span className="prototype-tag">A kinder first shop</span></a><div className="top-actions"><span className="live-dot"/> clickable prototype <button className="icon-button" aria-label="About this concept" onClick={() => setOverlay('About this concept')}><CircleHelp size={18}/></button></div></header>
    <div className="workspace">
      <section className="intro"><p className="eyebrow"><Sparkles size={14}/> A SHOP THAT MEETS YOU WHERE YOU ARE</p><h1>First time shopping<br/><em>should feel like this.</em></h1><p className="intro-copy">A concept for people who have never bought online. No jargon, no guessing—just a familiar guide in your corner.</p><div className="concept-pills"><span><Headphones size={14}/> Listen-to-Shop</span><span><Sparkles size={14}/> Sami, your guide</span><span><Package size={14}/> A journey, not a timeline</span></div>
        <div className="flow-picker"><div className="flow-label">CHOOSE A STORY <span>01 / 03</span></div><div className="flow-options">{(['A · First-time buyer','B · Returning buyer','C · Shop side'] as Flow[]).map((item, i) => <button key={item} onClick={() => resetFlow(item)} className={`flow-option ${flow === item ? 'selected' : ''}`}><span className="flow-letter">{String.fromCharCode(65+i)}</span><span><b>{item.split(' · ')[1]}</b><small>{['Guided from hello to order','Find it, choose it, done','A day in the shop'][i]}</small></span><ChevronRight size={16}/></button>)}</div></div>
        <div className="story-footer"><span className="story-step">{String(Math.max(1, ['home','voice','product','basket','delivery','payment','review','confirmation','tracking','shop'].indexOf(screen)+1)).padStart(2,'0')}</span><span><b>{title}</b><small>Tap anything. Every step has a way forward.</small></span><button aria-label="Previous screen" className="round-arrow" onClick={() => go(screen === 'tracking' ? 'confirmation' : screen === 'confirmation' ? 'review' : screen === 'review' ? 'payment' : screen === 'payment' ? 'delivery' : screen === 'delivery' ? 'basket' : screen === 'basket' ? 'product' : 'guide-choice')}><ArrowLeft size={17}/></button><button aria-label="Next screen" className="round-arrow dark" onClick={() => go(screen === 'home' ? 'product' : screen === 'product' ? 'basket' : screen === 'basket' ? 'delivery' : screen === 'delivery' ? 'payment' : screen === 'payment' ? 'review' : screen === 'review' ? 'confirmation' : 'tracking')}><ArrowRight size={17}/></button></div>
      </section>
      <section className="preview-wrap" aria-label="Interactive mobile app preview"><div className="preview-heading"><div><span className="eyebrow">THE SMARTSHOP DEMO</span><h2>{title}</h2></div><div className="language-switch" aria-label="Choose language">{['English','Français','عربي'].map((lang) => <button key={lang} onClick={() => setLanguage(lang)} className={language === lang ? 'active' : ''}>{lang}</button>)}</div></div>
        <div className="phone-stage"><div className="phone-glow"/><div className="phone"><div className="phone-notch"/><div className="phone-screen">
          <div className="app-header"><button className="bare" aria-label="Go back" onClick={() => go(screen === 'guide-choice' ? 'home' : screen === 'tracking' ? 'confirmation' : screen === 'confirmation' ? 'review' : screen === 'review' ? 'payment' : screen === 'payment' ? 'delivery' : screen === 'delivery' ? 'basket' : 'home')}><ArrowLeft size={17}/></button><div className="mini-brand"><span className="brand-mark tiny">s.</span> smartshop</div><div className="app-header-actions"><button className={`bare guide-toggle ${guideEnabled ? 'is-on' : ''}`} aria-label={guideEnabled ? 'Turn Sami guide off' : 'Turn Sami guide on'} aria-pressed={guideEnabled} onClick={() => setGuideEnabled((enabled) => !enabled)}><Sparkles size={16}/><span>Your guide</span></button><button className="bare" aria-label={spoken ? 'Stop read-aloud' : 'Hear this screen'} aria-pressed={spoken} onClick={() => spoken ? stopSpeaking() : speak(screen === 'voice' ? currentVoiceMessage : screen === 'product' ? `${selectedProduct.name}. ${selectedProduct.detail}. ${selectedProduct.price} Tunisian dinars. Pay when it arrives.` : screen === 'tracking' ? trackingMessage : screen === 'confirmation' ? 'The shop will call you to confirm your order. Nothing will be sent until you say yes.' : screen === 'delivery' ? deliveryGuideNarration : `${title}. Sami is here to help you at your own pace.`, screen === 'voice' ? voiceLocale : 'en-US')}><Volume2 size={17}/></button></div></div>
          <div className="phone-content" key={screen}>
            {screen === 'guide-choice' && <div className="guide-choice-screen"><div className="choice-art"><div className="choice-sun"/><SamiCharacter pose="wave" alt="Sami, your shopping guide" className="choice-character"/><button className="choice-message" onClick={() => speak('Aha! I’m Sami, your shop guide. I’ll walk with you, step by step.')} aria-label="Hear Sami introduce himself">Aha! I&apos;m Sami, your shop guide. I&apos;ll walk with you, step by step.<Volume2 size={14}/></button></div><h2>Shopping online,<br/><strong>made simple.</strong></h2><p className="choice-question">How would you like to shop?</p><button className={`listen-toggle-card ${listenToShop ? 'enabled' : ''}`} aria-pressed={listenToShop} onClick={() => setListenToShop((enabled) => { if (enabled) stopSpeaking(); return !enabled })}><span className="listen-toggle-icon"><Volume2 size={22}/></span><span><b>Sami will talk to you</b><small>Listen-to-Shop · {listenToShop ? 'on' : 'off'}</small></span><span className={`toggle-indicator ${listenToShop ? 'checked' : ''}`} aria-hidden="true">{listenToShop ? <Check size={14}/> : null}</span></button><button className="primary full" onClick={() => {setGuideEnabled(true); go('home')}}>Show me around with Sami</button><button className="outline full" onClick={() => {setGuideEnabled(false); go('home')}}>No thanks, Sami <ArrowRight size={16}/></button><p className="choice-footnote">You can turn Sami on or off anytime.</p></div>}
            {screen === 'home' && <><label className="search-field"><Search size={16} aria-hidden="true"/><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search for a product" aria-label="Search products"/></label>{guideEnabled && <div className="guide-card"><SamiCharacter pose="point" alt="" className="guide-character"/><button className="guide-message" onClick={() => speak('First time here? I can help you find something that feels right.')} aria-label="Hear Sami: First time here? I can help you find something that feels right."><p>First time here? I can help you find something that feels right.</p><span>Tap to hear Sami</span></button><button aria-label="Dismiss guide" className="dismiss" onClick={() => setGuideEnabled(false)}><X size={15}/></button></div>}<div className="section-head"><div><span className="kicker">A FEW GOOD THINGS</span><h3>Easy to love</h3></div></div><div className="product-grid">{filteredProducts.length ? filteredProducts.map((product, index) => <button key={product.name} className="product-tile" onClick={() => {setSelectedProduct(product); go('product')}}><div className="tile-photo"><Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 38vw, 150px"/><span className="tile-tag">{index === 0 ? 'A good first pick' : 'Easy everyday'}</span></div><b>{product.name}</b><small>{product.detail}</small><strong>{product.price} TND</strong></button>) : <p className="search-empty" role="status">No products found. Try another search.</p>}</div><div className="trust-line"><span>✓</span> Pay when it arrives · no card needed</div></>}
            {screen === 'voice' && <div className="voice-screen"><button type="button" className="voice-greeting" onClick={() => spoken ? stopSpeaking() : speak(currentVoiceMessage, voiceLocale)} aria-label={`Hear Sami: ${currentVoiceMessage}`} aria-pressed={spoken}><SamiCharacter pose="wave" alt="" className="voice-character"/><span aria-live="polite">{currentVoiceMessage}</span><Volume2 size={15} aria-hidden="true"/></button><div className="talk-composer"><button className={`talk-mic ${isListening ? 'active' : ''}`} onClick={startVoiceInput} aria-label={isListening ? 'Stop listening' : 'Talk to Sami'} aria-pressed={isListening}><Mic size={18}/></button><input type="text" value={voiceInput} onChange={(event) => setVoiceInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); sendVoiceMessage() } }} placeholder={isListening ? 'Listening…' : 'Talk to Sami'} aria-label="Message Sami"/><button className="talk-send" onClick={sendVoiceMessage} disabled={!voiceInput.trim()} aria-label="Send message"><ArrowRight size={17}/></button></div>{(voiceError || isListening) && <p className="talk-status" role="status" aria-live="polite">{voiceError || 'Listening…'}</p>}{voiceReply && <button className="text-action" onClick={() => go('product')}>Show me an easy pick <ArrowRight size={15}/></button>}</div>}
            {screen === 'product' && <><div className="product-hero"><Image src={selectedProduct.image} alt={selectedProduct.name} fill sizes="280px"/></div><div className="product-details"><span className="kicker">EASY EVERYDAY · {selectedProduct.fabric.toUpperCase()}</span><h2>{selectedProduct.name}</h2><div className="price-row"><strong>{selectedProduct.price} TND</strong><span>Pay on delivery</span></div><p>{selectedProduct.detail}</p><div className="size-head"><b>Choose your size</b><button onClick={() => setOverlay('Size guide')}>Size guide</button></div><div className="size-row">{['S','M','L','XL'].map(s => <button key={s} onClick={() => s === 'XL' ? setOverlay('XL is not available') : setSize(s)} className={size === s ? 'picked' : ''}>{s}</button>)}</div><div className="fit-note"><Check size={13}/> Easy returns if it doesn&apos;t feel right</div><button className="primary full" onClick={addToCart}>Add to basket <ShoppingBag size={16}/></button></div></>}
            {screen === 'basket' && <><div className="basket-title"><h2>Your basket <span>({cart || 1})</span></h2></div>{guideEnabled && <div className="basket-guide"><SamiCharacter pose="basket" alt="" className="basket-character"/><button className="guide-message" onClick={() => speak('Your basket is safe. Nothing is ordered until you say so.')} aria-label="Hear Sami: Your basket is safe. Nothing is ordered until you say so."><p>“Your basket is safe. Nothing is ordered until you say so.”</p><span>Tap to hear Sami</span></button></div>}<div className="basket-item"><div className="basket-photo"><Image src={selectedProduct.image} alt={selectedProduct.name} fill sizes="76px"/></div><div className="basket-info"><b>{selectedProduct.name}</b><small>{selectedProduct.color} · Size {size}</small><strong>{selectedProduct.price * (cart || 1)} TND</strong><div className="quantity"><button onClick={() => setCart(Math.max(0, cart-1))} aria-label="Remove one">−</button><span>{cart || 1}</span><button onClick={() => setCart(cart+1)} aria-label="Add one">+</button></div></div><button className="remove-link" onClick={() => {setCart(0); setOverlay('Basket · Empty')}}>Remove</button></div><div className="totals"><div><span>Delivery</span><b>7 TND</b></div><div className="total-line"><span>Total, at your door</span><b>{(cart || 1)*selectedProduct.price+7} TND</b></div></div><button className="primary full" onClick={() => go('delivery')}>Continue to delivery <ArrowRight size={16}/></button></>}
            {screen === 'delivery' && <Checkout title="Where should it find you?" step="1 of 3" next="Continue to payment" onNext={() => go('payment')} address={deliveryAddress} onAddressChange={setDeliveryAddress} location={deliveryLocation} onLocationChange={setDeliveryLocation} spoken={spoken} onGuideAudio={() => spoken ? stopSpeaking() : speak(deliveryGuideNarration)} />}
            {screen === 'payment' && <Checkout title="How would you like to pay?" step="2 of 3" next="Review my order" onNext={() => go('review')} address={deliveryAddress} onAddressChange={setDeliveryAddress} location={deliveryLocation} onLocationChange={setDeliveryLocation} spoken={spoken} onGuideAudio={() => spoken ? stopSpeaking() : speak(deliveryGuideNarration)} />}
            {screen === 'review' && <><CheckoutHeader step="3 of 3" title="One last look."/><div className="review-card"><div className="review-line"><span>{selectedProduct.name} · {selectedProduct.color} · {size}</span><b>{selectedProduct.price} TND</b><button onClick={() => go('basket')}>Edit</button></div><div className="review-line"><span>{deliveryLocation ? 'Delivery to your pinned location' : 'Delivery to Yasmine'}</span><b>7 TND</b><button onClick={() => go('delivery')}>Edit</button></div><div className="review-line"><span>Pay on delivery</span><b>Cash</b><button onClick={() => go('payment')}>Edit</button></div><div className="review-total"><span>Total at your door</span><b>{selectedProduct.price + 7} TND</b></div></div><div className="reassure"><Check size={16}/> You won&apos;t be charged now.<br/>The courier collects {selectedProduct.price + 7} TND at your door.</div><button className="primary full" onClick={() => go('confirmation')}>Place my order <ArrowRight size={16}/></button><button className="text-action" onClick={() => setOverlay('Help · Review')}>Need a hand? Ask Sami</button></>}
            {screen === 'confirmation' && <><div className="success-seal"><Check size={27}/></div><h2 className="confirm-title">Order received.</h2><p className="confirm-copy">SS-48213 · {selectedProduct.price + 7} TND</p><div className="mini-path"><span className="path-node done"><Check size={12}/></span><span className="path-dash"/><span className="path-node active"><Package size={13}/></span><span className="path-dash"/><span className="path-node"><Home size={13}/></span></div><div className="path-labels"><span>Ordered</span><span>On its way</span><span>Your door</span></div>{guideEnabled && <div className="confirmation-guide"><SamiCharacter pose="parcel" alt="" className="confirmation-character"/><button className="guide-message confirmation-message" onClick={() => speak('The shop will call before your parcel is sent.')} aria-label="Hear Sami: The shop will call before your parcel is sent."><p>“The shop will call before your parcel is sent.”</p><span>Tap to hear Sami</span></button></div>}<button className="primary full" onClick={() => go('tracking')}>Follow my parcel <ArrowRight size={16}/></button></>}
            {screen === 'tracking' && <><div className="tracking-top"><span className="kicker">ORDER SS-48213</span><strong>{journeyStops[trackingStep].title}</strong></div><div className="journey-map" aria-label="Order journey map"><svg viewBox="0 0 280 300" preserveAspectRatio="none" aria-hidden="true"><path className="map-road" d="M42 34 C220 22 247 90 207 112 C171 145 65 143 68 179 C71 213 214 210 221 244 C228 270 170 280 141 293"/><path className="map-road-center" d="M42 34 C220 22 247 90 207 112 C171 145 65 143 68 179 C71 213 214 210 221 244 C228 270 170 280 141 293"/></svg>{journeyStops.map((stop,index)=>{const Icon=stop.icon;return <div className={`map-stop stop-${index} ${index<trackingStep?'completed':index===trackingStep?'current':''}`} key={stop.title}><span><Icon size={16}/></span><b>{stop.title}</b></div>})}</div>{guideEnabled && <div className="journey-message"><SamiCharacter pose="point" alt="" className="journey-avatar"/><button type="button" className="journey-bubble" aria-label={spoken ? 'Stop listening to Sami' : `Hear Sami: ${trackingMessage}`} aria-pressed={spoken} onClick={() => spoken ? stopSpeaking() : speak(trackingMessage)}><p>{trackingMessage}</p><span className="journey-audio-icon" aria-hidden="true"><Volume2 size={15}/></span></button></div>}<button className="primary full map-next" onClick={() => setTrackingStep((step)=>(step+1)%journeyStops.length)}>Next stop <ArrowRight size={15}/></button></>}
            {screen === 'shop' && <><span className="kicker">THE OTHER SIDE OF A GOOD FIRST ORDER</span><h2 className="shop-title">Shop console <span className="demo-chip">DEMO</span></h2><p className="shop-sub">A simple view for the person preparing Yasmine&apos;s first parcel.</p><div className="shop-status"><span className="status-dot"/> AWAITING CONFIRMATION</div><div className="shop-order"><div><span className="kicker">NEW ORDER</span><b>SS-48213</b></div><strong>{selectedProduct.price + 7} <small>TND</small></strong><p>Yasmine Ben Salah<br/><small>{selectedProduct.name} · {size} · {selectedProduct.color}</small></p><div className="cash-note">Cash on delivery · Customer pays at the door</div></div><button className="primary full" onClick={() => setOverlay('Order confirmed')}>Confirm order <Check size={16}/></button><button className="outline full" onClick={() => setOverlay('Out for delivery')}>Mark out for delivery</button><button className="quiet-link center" onClick={() => setOverlay('Order rejected')}>Reject order</button><div className="shop-phone-hint"><span>↗</span> Switch to <button onClick={() => resetFlow('A · First-time buyer')}>Yasmine&apos;s phone</button> to follow the same parcel.</div></>}
          </div>{speechCaption && screen !== 'voice' && <div className="sr-only" role="status" aria-live="polite">{speechCaption}</div>}{screen !== 'guide-choice' && <nav className="bottom-nav" aria-label="Main navigation">{[{name:'Home',icon:Home,target:'home' as Screen},{name:'Talk',icon:Mic,target:'voice' as Screen},{name:'Cart',icon:ShoppingBasket,target:'basket' as Screen},{name:'Orders',icon:Package,target:'tracking' as Screen}].map(({name,icon:Icon,target})=><button key={name} onClick={() => nav(target)} className={(screen === target || (name === 'Cart' && ['product','delivery','payment','review'].includes(screen)) || (name === 'Orders' && ['confirmation','tracking'].includes(screen))) ? 'nav-active' : ''}><span className="nav-icon"><Icon size={17}/>{name === 'Cart' && cart > 0 && <i>{cart}</i>}</span><small>{name}</small></button>)}</nav>}
        </div><div className="home-indicator"/></div></div>
      </section>
    </div>
    {overlay && <div className="overlay-backdrop" role="presentation" onClick={() => setOverlay('')}><section className="sheet" role="dialog" aria-modal="true" aria-label={overlay} onClick={e => e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={() => setOverlay('')} aria-label="Close"><X size={17}/></button><h2>{overlay}</h2><OverlayBody name={overlay} onClose={() => setOverlay('')} onProduct={() => go('product')} onHome={() => go('home')} onBasket={() => go('basket')} onStep={(n) => setOverlay(n)} onTrack={() => go('tracking')} onShop={() => go('shop')} heightInput={heightInput} setHeightInput={setHeightInput} heightCm={heightCm} recommendedSize={recommendedSize} fitPreference={fitPreference} setFitPreference={setFitPreference} onUseSize={() => {setSize(recommendedSize); setOverlay('')}}/></section></div>}
  </main>
}

function SamiCharacter({ pose, alt, className = '' }: { pose: SamiPose; alt: string; className?: string }) {
  return <span className={`sami-character ${className}`}><img src={samiPoses[pose]} alt={alt}/></span>
}


function CheckoutHeader({step,title}:{step:string;title:string}) {return <div className="checkout-head"><span className="kicker">YOUR FIRST ORDER · {step}</span><h2>{title}</h2><div className="progress"><i style={{width: step.startsWith('1') ? '33%' : step.startsWith('2') ? '66%' : '100%'}}/></div></div>}

function openStreetMapEmbedUrl({latitude,longitude}:DeliveryLocation) {
  const radius = 0.006
  const map = new URL('https://www.openstreetmap.org/export/embed.html')
  map.searchParams.set('bbox', [longitude-radius, latitude-radius, longitude+radius, latitude+radius].join(','))
  map.searchParams.set('layer', 'mapnik')
  map.searchParams.set('marker', `${latitude},${longitude}`)
  return map.toString()
}

function Checkout({title,step,next,onNext,address,onAddressChange,location,onLocationChange,spoken,onGuideAudio}:{title:string;step:string;next:string;onNext:()=>void;address:string;onAddressChange:(address:string)=>void;location:DeliveryLocation|null;onLocationChange:(location:DeliveryLocation)=>void;spoken:boolean;onGuideAudio:()=>void}) {
  const [locationMessage, setLocationMessage] = useState('')
  const [locationError, setLocationError] = useState(false)
  const [isLocating, setIsLocating] = useState(false)

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(true)
      setLocationMessage('Location is not available in this browser. You can enter your address manually.')
      return
    }

    setIsLocating(true)
    setLocationError(false)
    setLocationMessage('Waiting for your location…')
    navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        const nextLocation = {latitude: coords.latitude, longitude: coords.longitude}
        onLocationChange(nextLocation)
        onAddressChange('Current location')
        setLocationMessage('Pin placed. Add a street or building detail above if needed.')
        setIsLocating(false)
      },
      (error) => {
        setLocationError(true)
        setLocationMessage(error.code === error.PERMISSION_DENIED
          ? 'Location access was blocked. Allow it in your browser or enter your address manually.'
          : error.code === error.TIMEOUT
            ? 'We could not find your location in time. Try again or enter your address manually.'
            : 'Your location could not be found. Try again or enter your address manually.')
        setIsLocating(false)
      },
      {enableHighAccuracy:true, timeout:15000, maximumAge:30000},
    )
  }

  return <><CheckoutHeader step={step} title={title}/>{step.startsWith('1') ? <><button type="button" className="checkout-guide" aria-label={spoken ? 'Stop Sami’s delivery message' : 'Hear Sami’s delivery message'} aria-pressed={spoken} onClick={onGuideAudio}><SamiCharacter pose="point" alt="" className="checkout-guide-character"/><span className="checkout-guide-copy"><b>Let me help your order find its way to you.</b><span>Share your full name, phone, and delivery location. Not sure where you are? Tap “Use my current location” and I&apos;ll find you. Check your details before continuing—you can still change them until your order is on the road.</span></span><Volume2 className="checkout-guide-audio" size={15} aria-hidden="true"/></button><label className="input-label">Your full name<input defaultValue="Yasmine Ben Salah" autoComplete="name"/></label><label className="input-label">Phone number<input defaultValue="+216 22 123 456" type="tel" autoComplete="tel"/></label><label className="input-label">Delivery location<input value={address} onChange={(event) => onAddressChange(event.target.value)} autoComplete="street-address"/></label><div className="location-picker"><button type="button" className="location-button" onClick={useCurrentLocation} disabled={isLocating} aria-busy={isLocating}><Crosshair size={16} aria-hidden="true"/>{isLocating ? 'Finding your location…' : location ? 'Update my current location' : 'Use my current location'}</button><p className="location-note">Your browser will ask permission. Your coordinates are shared with OpenStreetMap to show the pin.</p>{locationMessage ? <p className={`location-status${locationError ? ' is-error' : ''}`} role="status" aria-live="polite">{locationMessage}</p> : location && <p className="location-status" role="status">Current location pin is set.</p>}{location && <div className="location-map"><iframe title="Map showing your current location pin" src={openStreetMapEmbedUrl(location)} referrerPolicy="no-referrer"/></div>}</div><div className="delivery-summary"><Package size={16}/><span>Delivery to your door</span><b>7 TND</b></div></> : <div className="payment-choice"><div className="cash-illustration">د.ت</div><div><b>Cash when it arrives</b><small>Pay the courier after you receive your order.</small></div><span className="check-ring"><Check size={13}/></span><div className="pay-note">No bank card needed. You won’t be charged until your parcel is at your door.</div></div>}<button className="primary full checkout-cta" onClick={onNext}>{next}<ArrowRight size={16}/></button></>
}
function OverlayBody({name,onClose,onProduct,onHome,onBasket,onStep,onTrack,onShop,heightInput,setHeightInput,heightCm,recommendedSize,fitPreference,setFitPreference,onUseSize}:{name:string;onClose:()=>void;onProduct:()=>void;onHome:()=>void;onBasket:()=>void;onStep:(s:string)=>void;onTrack:()=>void;onShop:()=>void;heightInput:string;setHeightInput:(value:string)=>void;heightCm:number;recommendedSize:string;fitPreference:'Closer'|'Relaxed';setFitPreference:(value:'Closer'|'Relaxed')=>void;onUseSize:()=>void}) {
 const [choice,setChoice]=useState('');
 if(name.includes('Find it for me')) {const step=Number(name.match(/\d/)?.[0]||1);return <><p>{['What are you shopping for today?','What matters most to you?','What feels like your style?'][step-1]||'What would make this feel easy?'}</p><div className="choice-list">{(step===1?['Something to wear','A gift','Just browsing']:step===2?['Easy everyday','A special occasion','Keep it under 60 TND']:['Comfortable & simple','A little more dressed up','Show me your best pick']).map(x=><button key={x} onClick={()=>{setChoice(x); if(step<3)onStep(`Find it for me ${step+1} of 3`);else onStep('Results for your picks')}}>{x}<ChevronRight size={16}/></button>)}</div><button className="sheet-quiet" onClick={onClose}>I&apos;ll look around myself</button></>}
 if(name==='Find your size')return <><p>Share your height and preferred fit for an optional starting suggestion.</p><label className="fit-height">Your height <span><input aria-label="Your height in centimeters" type="number" min="140" max="205" value={heightInput} onChange={(event)=>setHeightInput(event.target.value)} onBlur={()=>setHeightInput(String(Math.min(205,Math.max(140,Number(heightInput)||168))))}/> cm</span></label><div className="fit-options" role="group" aria-label="How would you like it to fit?">{(['Closer','Relaxed'] as const).map(option=><button key={option} className={fitPreference===option?'active':''} onClick={()=>setFitPreference(option)}>{option} fit</button>)}</div><div className="size-suggestion"><span>YOUR STARTING SIZE</span><b>{recommendedSize}</b><small>Based on around {heightCm} cm and a {fitPreference.toLowerCase()} fit.</small></div><button className="primary full" onClick={onUseSize}>Use size {recommendedSize} <Check size={15}/></button><button className="outline full" onClick={()=>onStep('Size guide')}>See the size guide</button></>;
 if(name==='Size guide')return <><p>Use this as a simple reference. The shop can confirm the fit if you&apos;re unsure.</p><div className="size-table"><div><b>Size</b><b>Chest</b><b>Fit</b></div><div><span>S</span><span>88–94</span><span>Closer</span></div><div className="table-highlight"><span>M</span><span>95–102</span><span>Relaxed</span></div><div><span>L</span><span>103–110</span><span>Roomy</span></div></div><button className="primary full" onClick={onClose}>Back to product</button><button className="outline full" onClick={()=>onStep('Find your size')}>Find my size</button></>;
 if(name.includes('Added'))return <><div className="added-emblem"><ShoppingBag size={25}/><Check size={15}/></div><p>Nice choice. Your tee is safely in your basket. You can still change your mind.</p><button className="primary full" onClick={onBasket}>View basket <ArrowRight size={15}/></button><button className="outline full" onClick={onHome}>Keep looking</button></>;
 if(name.includes('Empty'))return <><div className="added-emblem"><ShoppingBasket size={26}/></div><p>Your basket is empty. Nothing has been ordered.</p><button className="primary full" onClick={onHome}>Explore the shop</button></>;
 if(name.includes('heard'))return <><p>Sami heard this. Is it close?</p><div className="heard-card"><AudioLines size={18}/><span>“Something nice for a wedding, under 100 dinars.”</span><button onClick={()=>onStep('')}>Edit</button></div><button className="primary full" onClick={onProduct}>Yes, show me <ArrowRight size={15}/></button><button className="outline full" onClick={onClose}>Try saying it again</button><div className="concept-note">CONCEPT PREVIEW · No audio is recorded</div></>;
 if(name.includes('XL'))return <><p>That size is not available in this color right now. Sami can help find the closest fit.</p><button className="primary full" onClick={()=>onStep('Find your size')}>Find my size</button><button className="outline full" onClick={onClose}>Choose another size</button></>;
 if(name.includes('wrong size')||name.includes('fix that'))return <><p>That&apos;s okay. We want your first order to feel right.</p><div className="help-steps"><span>01</span> Keep the tag on and try it at home.<span>02</span> Contact us within 7 days.<span>03</span> We&apos;ll arrange an exchange, free.</div><button className="primary full" onClick={onClose}>Got it, thank you</button></>;
 if(name==='You’re still in control'||name.includes('control'))return <><p>Nothing leaves the shop until you choose. You can still:</p><div className="choice-list"><button onClick={onClose}>Change the size <ChevronRight size={15}/></button><button onClick={onClose}>Remove something <ChevronRight size={15}/></button><button onClick={onClose}>Leave without ordering <ChevronRight size={15}/></button></div><button className="primary full" onClick={onClose}>That helps, thanks</button></>;
 if(name==='Shopping guidance')return <><p>Choose how much help you&apos;d like. You can change this any time.</p><button className="primary full" onClick={onClose}>Keep Sami with me</button><button className="outline full" onClick={onHome}>Let me explore alone</button></>;
 if(name.startsWith('Order confirmed')||name.startsWith('Out for delivery')||name.startsWith('Order rejected'))return <><div className="status-confirm"><Check size={22}/></div><p>{name.startsWith('Order confirmed')?'Order SS-48213 is confirmed. Yasmine will see the update on her phone.':name.startsWith('Out')?'The parcel is on its way. The customer has been notified.':'This order was rejected. The customer has been notified.'}</p><button className="primary full" onClick={()=>name.startsWith('Order rejected')?onClose():onTrack()}>{name.startsWith('Order rejected')?'Done':'See the customer journey'} <ArrowRight size={15}/></button><button className="outline full" onClick={onShop}>Back to shop console</button></>;
 if(name.includes('Cancel this order'))return <><p>Your order will be cancelled. You haven&apos;t been charged.</p><button className="primary full" onClick={onClose}>Keep my order</button><button className="outline full" onClick={onClose}>Cancel my order</button></>;
 if(name.startsWith('Help'))return <><p>{name.includes('Delivery')?'Your parcel comes to your door. Delivery is 7 TND, paid with the courier.':name.includes('Payment')?'You pay in cash only when the parcel arrives. No card details needed.':'Sami can explain any part of the order before you place it.'}</p><button className="primary full" onClick={onClose}>That makes sense</button></>;
 return <><p>{name==='About this concept'?'A visual prototype about making a first online purchase feel human, understandable, and safe.':'Three design decisions make this shop feel different: listen-first interaction, a familiar guide, and a parcel journey that tells a story.'}</p><div className="concept-note">VOICE · GUIDE · JOURNEY<br/>This demo illustrates concepts. Voice, sizing, and order updates are not connected to live services.</div><button className="primary full" onClick={onClose}>Back to the experience</button></>
}
