// certificate.js - логика для удостоверений

// Глобальное состояние выбранного скина (используем window для доступа из index.html)
window.selectedSkinId = null;
window.selectedRankId = null;
window.selectedGender = null;
let cachedCompositePhoto = null; // кэшируем готовое фото для удостоверения

document.addEventListener('DOMContentLoaded', function() {
    // Получаем элементы
    const tabBtns = document.querySelectorAll('.tab-btn');
    const certRankText = document.getElementById('certRankText');
    const certSurname = document.getElementById('certSurname');
    const certName = document.getElementById('certName');
    const certPatronymic = document.getElementById('certPatronymic');
    const certPosition = document.getElementById('certPosition');
    const certNumber = document.getElementById('certNumber');
    const certAccount = document.getElementById('certAccount');
    const certDepartment = document.getElementById('certDepartment');
    const certIssueDate = document.getElementById('certIssueDate');
    const certSignature = document.getElementById('certSignature');
    const generateCertBtn = document.getElementById('generateCertBtn');
    
    // Функция загрузки изображения
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Не удалось загрузить: ${src}`));
            img.src = src + '?nocache=' + Date.now();
        });
    }
    
    // Функция создания композитного фото (голова + форма)
    async function createCompositePhoto(skinId, rankId) {
        try {
            // Получаем конфигурацию
            const gender = window.selectedGender || 'female';
            const skinConfig = CERTIFICATE_CONFIG.skins[gender];
            if (!skinConfig) throw new Error(`Нет конфигурации для пола ${gender}`);
            
            // Пути к файлам
            const headPath = `${skinConfig.headsPath}${skinId}.png`;
            const uniformFilename = RANK_TO_UNIFORM[rankId];
            if (!uniformFilename) throw new Error(`Нет формы для звания ${rankId}`);
            
            const uniformPath = `${skinConfig.uniformsPath}${uniformFilename}`;
            const offset = skinConfig.headOffsets[skinId];
            if (!offset) throw new Error(`Нет координат для скина ${skinId}`);
            
            // Загружаем изображения
            const [headImg, uniformImg] = await Promise.all([
                loadImage(headPath),
                loadImage(uniformPath)
            ]);
            
            // Создаём canvas для композита
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Размеры как у головы (или формы, они должны совпадать)
            canvas.width = headImg.width;
            canvas.height = headImg.height;
            
            // Рисуем голову
            ctx.drawImage(headImg, 0, 0);
            
            // Рисуем форму поверх с наложением
            ctx.drawImage(uniformImg, offset.x, offset.y);
            
            // Возвращаем как Image объект
            const compositeImg = new Image();
            compositeImg.src = canvas.toDataURL('image/png');
            
            return new Promise((resolve) => {
                compositeImg.onload = () => resolve(compositeImg);
            });
        } catch (error) {
            console.error('Ошибка создания композитного фото:', error);
            // В случае ошибки возвращаем null - фото не будет отображаться
            return null;
        }
    }
    
    // Функция для генерации штрих-кода
    function generateBarcodeImage(value, width, height) {
        return new Promise((resolve, reject) => {
            try {
                if (typeof JsBarcode === 'undefined') {
                    reject(new Error('JsBarcode не загружена'));
                    return;
                }

                let cleanValue = value.replace(/[^0-9]/g, '');
                if (cleanValue.length === 0) {
                    reject(new Error('Некорректное значение для штрих-кода'));
                    return;
                }

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                
                JsBarcode(tempCanvas, cleanValue, {
                    format: "CODE39",
                    displayValue: false,
                    width: 2,
                    height: height,
                    margin: 0,
                    background: '#ffffff',
                    lineColor: '#000000'
                });
                
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Ошибка загрузки штрих-кода'));
                img.src = tempCanvas.toDataURL('image/png');
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // Форматирование даты
    function formatDateToRussian(date) {
        if (!date || isNaN(date.getTime())) return '';
        
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day} ${month} ${year} г.`;
    }
    
    function addYears(date, years) {
        const newDate = new Date(date);
        newDate.setFullYear(newDate.getFullYear() + years);
        return newDate;
    }
    
    function wrapText(ctx, text, maxWidth, fontSize, fontFamily, fontWeight, fontStyle) {
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (let word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    function buildDynamicText(textConfig) {
        if (!textConfig.dynamic) return textConfig.text;
        
        if (textConfig.dynamicFields) {
            let result = '';
            for (let field of textConfig.dynamicFields) {
                if (field === 'rank') {
                    result += (certRankText ? certRankText.value : '');
                    result += '\n';
                } else if (field === 'surname') {
                    result += (certSurname ? certSurname.value : '');
                    result += '\n';
                } else if (field === 'name') {
                    result += (certName ? certName.value : '');
                } else if (field === 'patronymic') {
                    result += ' ' + (certPatronymic ? certPatronymic.value : '');
                } else if (field === 'position') {
                    result += (certPosition ? certPosition.value : '');
                } else if (field === 'number') {
                    let number = certNumber ? certNumber.value : '';
                    number = number.replace(/\D/g, '').slice(0, 6);
                    result += number;
                } else if (field === 'personalNumber') {
                    const deptLetter = certDepartment ? certDepartment.value : 'Р';
                    let account = certAccount ? certAccount.value : '';
                    account = account.replace(/\D/g, '').slice(0, 6);
                    if (account && account.length > 0) {
                        result += deptLetter + ' - ' + account;
                    }
                } else if (field === 'issueDate') {
                    if (certIssueDate && certIssueDate.value) {
                        const date = new Date(certIssueDate.value);
                        result += formatDateToRussian(date);
                    }
                } else if (field === 'expiryDate') {
                    if (certIssueDate && certIssueDate.value) {
                        const date = new Date(certIssueDate.value);
                        const expiryDate = addYears(date, 5);
                        result += formatDateToRussian(expiryDate);
                    }
                }
            }
            return result.trim();
        }
        
        return textConfig.text;
    }
    
    function drawMultilineText(ctx, text, x, y, width, height, fontSize, fontFamily, fontWeight, color, lineHeight, textAlign, fontStyle = 'normal') {
        if (!text) return;
        
        ctx.save();
        
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        
        let lines = [];
        
        if (text.includes('\n')) {
            const explicitLines = text.split('\n');
            for (let line of explicitLines) {
                const wrappedLines = wrapText(ctx, line, width, fontSize, fontFamily, fontWeight, fontStyle);
                lines.push(...wrappedLines);
            }
        } else {
            lines = wrapText(ctx, text, width, fontSize, fontFamily, fontWeight, fontStyle);
        }
        
        const finalLineHeight = (lineHeight > 0 ? lineHeight : fontSize * 1.2);
        
        ctx.fillStyle = color;
        ctx.textAlign = textAlign || 'left';
        ctx.textBaseline = 'top';
        
        let startX = x;
        if (textAlign === 'center') {
            startX = x + (width / 2);
        } else if (textAlign === 'right') {
            startX = x + width;
        }
        
        lines.forEach((line, index) => {
            const currentY = y + (index * finalLineHeight);
            ctx.fillText(line, startX, currentY);
        });
        
        ctx.restore();
    }
    
    function drawStaticMultilineText(ctx, text, x, y, width, height, fontSize, fontFamily, fontWeight, color, lineHeight, textAlign, fontStyle = 'normal') {
        if (!text) return;
        
        ctx.save();
        
        let lines = text.split('\n');
        const finalLineHeight = (lineHeight > 0 ? lineHeight : fontSize * 1.2);
        
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textAlign = textAlign || 'left';
        ctx.textBaseline = 'top';
        
        let startX = x;
        if (textAlign === 'center') {
            startX = x + (width / 2);
        } else if (textAlign === 'right') {
            startX = x + width;
        }
        
        lines.forEach((line, index) => {
            const currentY = y + (index * finalLineHeight);
            ctx.fillText(line, startX, currentY);
        });
        
        ctx.restore();
    }
    
    function fitCanvasToContainer(canvas) {
        const container = canvas.parentElement;
        if (!container) return;
        
        const containerWidth = container.clientWidth - 20;
        const containerHeight = container.clientHeight - 20;
        
        const maxDisplayWidth = 1200;
        const maxDisplayHeight = 800;
        
        let displayWidth = canvas.width;
        let displayHeight = canvas.height;
        
        if (displayWidth > maxDisplayWidth) {
            const ratio = maxDisplayWidth / displayWidth;
            displayWidth = maxDisplayWidth;
            displayHeight = displayHeight * ratio;
        }
        
        if (displayHeight > maxDisplayHeight) {
            const ratio = maxDisplayHeight / displayHeight;
            displayHeight = maxDisplayHeight;
            displayWidth = displayWidth * ratio;
        }
        
        if (displayWidth > containerWidth) {
            const ratio = containerWidth / displayWidth;
            displayWidth = containerWidth;
            displayHeight = displayHeight * ratio;
        }
        
        if (displayHeight > containerHeight) {
            const ratio = containerHeight / displayHeight;
            displayHeight = containerHeight;
            displayWidth = displayWidth * ratio;
        }
        
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
    }
    
    async function drawBarcode(ctx, value, config) {
        if (!value || value.length === 0) return false;
        
        try {
            let cleanValue = value.replace(/\D/g, '');
            if (cleanValue.length === 0) return false;
            
            while (cleanValue.length < 6) {
                cleanValue = '0' + cleanValue;
            }
            
            const barcodeImg = await generateBarcodeImage(cleanValue, config.width, config.height);
            
            ctx.save();
            
            const rotation = config.rotation || 0;
            
            if (rotation === 90) {
                ctx.translate(config.x, config.y);
                ctx.rotate(90 * Math.PI / 180);
                ctx.drawImage(barcodeImg, 0, 0, config.width, config.height);
            } else if (rotation === 270) {
                ctx.translate(config.x + config.width, config.y);
                ctx.rotate(270 * Math.PI / 180);
                ctx.drawImage(barcodeImg, 0, 0, config.width, config.height);
            } else if (rotation === 180) {
                ctx.translate(config.x + config.width, config.y + config.height);
                ctx.rotate(180 * Math.PI / 180);
                ctx.drawImage(barcodeImg, 0, 0, config.width, config.height);
            } else {
                ctx.drawImage(barcodeImg, config.x, config.y, config.width, config.height);
            }
            
            ctx.restore();
            return true;
            
        } catch (error) {
            console.warn('Ошибка генерации штрих-кода:', error);
            return false;
        }
    }
    
    // ГЛАВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ УДОСТОВЕРЕНИЯ
    async function generateCertificate() {
        const certCanvas = document.getElementById('certCanvas');
        const certCtx = certCanvas ? certCanvas.getContext('2d') : null;
        
        if (!certCanvas || !certCtx) {
            console.error('Canvas не найден');
            return;
        }
        
        try {
            certCanvas.style.opacity = '0.5';
            
            // 1. Загружаем фон
            const backgroundImg = await loadImage(CERTIFICATE_CONFIG.background);
            certCanvas.width = backgroundImg.width;
            certCanvas.height = backgroundImg.height;
            certCtx.drawImage(backgroundImg, 0, 0);
            
            // 2. Проверяем, выбрано ли фото (есть ли скин, звание и пол)
            const isPhotoSelected = window.selectedSkinId && window.selectedRankId && window.selectedGender;
            
            let photoImg = null;
            
            if (isPhotoSelected) {
                try {
                    photoImg = await createCompositePhoto(window.selectedSkinId, window.selectedRankId);
                } catch (err) {
                    console.warn('Ошибка создания композитного фото', err);
                    photoImg = null;
                }
            }
            
            // Отрисовываем фото ТОЛЬКО если оно есть и было успешно создано
            if (photoImg) {
                const photoConfig = CERTIFICATE_CONFIG.photo;
                const targetX = photoConfig.x;
                const targetY = photoConfig.y;
                const targetWidth = photoConfig.width;
                const targetHeight = photoConfig.height;
                
                // Масштабируем фото под рамку
                const imgWidth = photoImg.width;
                const imgHeight = photoImg.height;
                
                const scaleByHeight = targetHeight / imgHeight;
                let scaledWidth = imgWidth * scaleByHeight;
                let scaledHeight = targetHeight;
                let drawX = targetX + (targetWidth - scaledWidth) / 2;
                
                certCtx.save();
                certCtx.beginPath();
                certCtx.rect(targetX, targetY, targetWidth, targetHeight);
                certCtx.clip();
                certCtx.drawImage(photoImg, drawX, targetY, scaledWidth, scaledHeight);
                certCtx.restore();
                
                // 3. ГОЛОГРАФИЧЕСКАЯ НАКЛЕЙКА - появляется ТОЛЬКО когда есть фото
                try {
                    const hologramConfig = CERTIFICATE_CONFIG.hologram;
                    if (hologramConfig && hologramConfig.path) {
                        const hologramImg = await loadImage(hologramConfig.path);
                        certCtx.drawImage(hologramImg, hologramConfig.x, hologramConfig.y, hologramConfig.width, hologramConfig.height);
                    }
                } catch (hologramError) {
                    console.warn('Голограмма не загружена');
                }
            } else {
                // Если фото не выбрано - оставляем область фото пустой (ничего не рисуем)
            }
            
            // 4. Печать
            try {
                const stampImg = await loadImage(CERTIFICATE_CONFIG.stamp);
                const stampPos = CERTIFICATE_CONFIG.stampPosition;
                certCtx.drawImage(stampImg, stampPos.x, stampPos.y, stampPos.width, stampPos.height);
            } catch (stampError) {
                console.warn('Печать не загружена');
            }
            
            // 5. Тексты
            if (CERTIFICATE_CONFIG.texts && CERTIFICATE_CONFIG.texts.length) {
                for (const textItem of CERTIFICATE_CONFIG.texts) {
                    const actualText = buildDynamicText(textItem);
                    if (actualText) {
                        if (textItem.dynamic) {
                            drawMultilineText(
                                certCtx, actualText,
                                textItem.x, textItem.y, textItem.width, textItem.height,
                                textItem.fontSize, textItem.fontFamily, textItem.fontWeight,
                                textItem.color, textItem.lineHeight, textItem.textAlign,
                                textItem.fontStyle || 'normal'
                            );
                        } else {
                            drawStaticMultilineText(
                                certCtx, actualText,
                                textItem.x, textItem.y, textItem.width, textItem.height,
                                textItem.fontSize, textItem.fontFamily, textItem.fontWeight,
                                textItem.color, textItem.lineHeight, textItem.textAlign,
                                textItem.fontStyle || 'normal'
                            );
                        }
                    }
                }
            }
            
            // 6. Подпись
            try {
                if (certSignature && certSignature.value) {
                    const signaturePath = certSignature.value;
                    const signatureConfig = CERTIFICATE_CONFIG.signatures.find(sig => sig.path === signaturePath);
                    if (signatureConfig) {
                        const signatureImg = await loadImage(signatureConfig.path);
                        certCtx.drawImage(signatureImg, signatureConfig.x, signatureConfig.y, signatureConfig.width, signatureConfig.height);
                    }
                }
            } catch (signatureError) {
                console.warn('Подпись не загружена');
            }
            
            // 7. Штрих-код
            const barcodeConfig = CERTIFICATE_CONFIG.barcode;
            if (barcodeConfig && certNumber) {
                const numberValue = certNumber.value.replace(/\D/g, '');
                if (numberValue && numberValue.length > 0) {
                    await drawBarcode(certCtx, numberValue, barcodeConfig);
                }
            }
            
            fitCanvasToContainer(certCanvas);
            certCanvas.style.opacity = '1';
            
        } catch (error) {
            console.error('Ошибка при генерации удостоверения:', error);
            certCanvas.width = 800;
            certCanvas.height = 600;
            certCtx.fillStyle = '#1a1d24';
            certCtx.fillRect(0, 0, 800, 600);
            certCtx.fillStyle = '#e6e6e6';
            certCtx.font = '16px Arial';
            certCtx.textAlign = 'center';
            certCtx.fillText('Ошибка загрузки фона', 400, 300);
            fitCanvasToContainer(certCanvas);
            certCanvas.style.opacity = '1';
        }
    }
    
    function saveCertificate() {
        const certCanvas = document.getElementById('certCanvas');
        if (!certCanvas || certCanvas.width === 0 || certCanvas.height === 0) {
            alert('Сначала сгенерируйте удостоверение');
            return;
        }
        try {
            const dataURL = certCanvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'udostoverenie.png';
            link.href = dataURL;
            link.click();
        } catch (error) {
            alert('Не удалось сохранить изображение');
        }
    }
    
    // ========== МОДАЛЬНОЕ ОКНО ВЫБОРА СКИНА ==========
    function showSkinSelector(gender, rankId) {
        // Удаляем существующее модальное окно
        const existingModal = document.querySelector('.skin-modal-overlay');
        if (existingModal) existingModal.remove();
        
        const overlay = document.createElement('div');
        overlay.className = 'skin-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'skin-modal';
        
        const title = document.createElement('h2');
        title.textContent = 'Выберите внешность';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✖';
        closeBtn.className = 'skin-modal-close';
        closeBtn.onclick = () => overlay.remove();
        
        const skinsGrid = document.createElement('div');
        skinsGrid.className = 'skins-grid';
        
        const skinConfig = CERTIFICATE_CONFIG.skins[gender];
        const availableSkins = skinConfig.availableSkins;
        
        availableSkins.forEach(skinId => {
            const skinCard = document.createElement('div');
            skinCard.className = 'skin-card';
            
            const previewImg = document.createElement('img');
            previewImg.src = `${skinConfig.previewsPath}${skinId}.png`;
            previewImg.alt = `Скин ${skinId}`;
            
            const skinIdSpan = document.createElement('span');
            skinIdSpan.textContent = `#${skinId}`;
            
            skinCard.appendChild(previewImg);
            skinCard.appendChild(skinIdSpan);
            
            skinCard.onclick = async () => {
				console.log(`Выбран скин: ${skinId}`); // Добавьте лог
				window.selectedSkinId = skinId;
				window.selectedGender = gender;
				window.selectedRankId = rankId;
				
				// Очищаем кэш композитного фото
				cachedCompositePhoto = null;
                
                // Показываем уведомление
                const notification = document.createElement('div');
                notification.textContent = `✅ Внешность выбрана! Фото сформировано.`;
                notification.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;background:#1f2937e6;color:white;padding:12px 18px;border-radius:40px;font-size:14px;text-align:center;border:1px solid #3a7afe;z-index:20001';
                document.body.appendChild(notification);
                setTimeout(() => {
                    notification.style.opacity = '0';
                    notification.style.transition = 'opacity 0.4s';
                    setTimeout(() => notification.remove(), 500);
                }, 2000);
                
                // Закрываем модальное окно
                overlay.remove();
                
                // Обновляем удостоверение
                setTimeout(() => generateCertificate(), 100);
            };
            
            skinsGrid.appendChild(skinCard);
        });
        
        modal.appendChild(closeBtn);
        modal.appendChild(title);
        modal.appendChild(skinsGrid);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');
        
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };
    }
    
    // ========== МОДАЛЬНОЕ ОКНО ВЫБОРА ФОТО (переопределяем) ==========
    function showPhotoWizard() {
        if (document.querySelector('.modal-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'photo-modal';
        
        const stepIndicator = document.createElement('div');
        stepIndicator.className = 'step-indicator';
        const step1 = document.createElement('span');
        step1.className = 'step';
        step1.textContent = '1. Пол';
        const step2 = document.createElement('span');
        step2.className = 'step';
        step2.textContent = '2. Звание';
        const step3 = document.createElement('span');
        step3.className = 'step';
        step3.textContent = '3. Внешность';
        stepIndicator.appendChild(step1);
        stepIndicator.appendChild(step2);
        stepIndicator.appendChild(step3);
        
        const title = document.createElement('h2');
        title.className = 'modal-title';
        const sub = document.createElement('div');
        sub.className = 'modal-sub';
        
        // Секция пола
        const genderSection = document.createElement('div');
        genderSection.className = 'gender-section';
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'gender-cards';
        
        const genders = [
            { id: 'female', label: 'Женский', icon: '👩‍✈️' },
            { id: 'male', label: 'Мужской', icon: '👮‍♂️' }
        ];
        
        genders.forEach(gender => {
            const card = document.createElement('div');
            card.className = 'gender-card';
            const iconDiv = document.createElement('div');
            iconDiv.className = 'gender-icon';
            iconDiv.textContent = gender.icon;
            const titleEl = document.createElement('h3');
            titleEl.textContent = gender.label;
            card.appendChild(iconDiv);
            card.appendChild(titleEl);
            card.onclick = () => {
                window.selectedGender = gender.id;
                currentWizardStep = 2;
                updateWizardContent();
            };
            cardsContainer.appendChild(card);
        });
        genderSection.appendChild(cardsContainer);
        
        // Секция званий
        const rankSection = document.createElement('div');
        rankSection.className = 'rank-section';
        rankSection.style.display = 'none';
        
        const ranksGrid = document.createElement('div');
        ranksGrid.className = 'ranks-grid';
        
        const ranks = [
            { id: 'ryadovoy', name: 'Рядовой' },
            { id: 'serzhant', name: 'Сержант' },
            { id: 'starshina', name: 'Старшина' },
            { id: 'praporshchik', name: 'Прапорщик' },
            { id: 'leytenant', name: 'Лейтенант' },
            { id: 'starlyeytenant', name: 'Старший лейтенант' },
            { id: 'kapitan', name: 'Капитан' },
            { id: 'mayor', name: 'Майор' },
            { id: 'podpolkovnik', name: 'Подполковник' },
            { id: 'polkovnik', name: 'Полковник' }
        ];
        
        ranks.forEach(rank => {
            const rankDiv = document.createElement('div');
            rankDiv.className = 'rank-item';
            rankDiv.textContent = rank.name;
            rankDiv.onclick = () => {
                window.selectedRankId = rank.id;
                currentWizardStep = 3;
                updateWizardContent();
                // Показываем выбор скина
                showSkinSelector(window.selectedGender, window.selectedRankId);
                overlay.remove();
            };
            ranksGrid.appendChild(rankDiv);
        });
        rankSection.appendChild(ranksGrid);
        
        const buttonsDiv = document.createElement('div');
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'close-modal-btn cancel-modal-btn';
        cancelBtn.textContent = '✖ Отмена';
        cancelBtn.onclick = () => overlay.remove();
        buttonsDiv.appendChild(cancelBtn);
        
        modal.appendChild(stepIndicator);
        modal.appendChild(title);
        modal.appendChild(sub);
        modal.appendChild(genderSection);
        modal.appendChild(rankSection);
        modal.appendChild(buttonsDiv);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');
        
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        
        let currentWizardStep = 1;
        
        function updateWizardContent() {
            if (currentWizardStep === 1) {
                genderSection.style.display = 'block';
                rankSection.style.display = 'none';
                title.textContent = 'Выберите пол';
                sub.textContent = 'Укажите пол сотрудника';
                step1.classList.add('active');
                step1.classList.remove('completed');
                step2.classList.remove('active', 'completed');
                step3.classList.remove('active', 'completed');
            } else if (currentWizardStep === 2) {
                genderSection.style.display = 'none';
                rankSection.style.display = 'block';
                title.textContent = 'Выберите звание';
                sub.textContent = window.selectedGender === 'female' ? 'Женский персонаж' : 'Мужской персонаж';
                step1.classList.add('completed');
                step1.classList.remove('active');
                step2.classList.add('active');
                step2.classList.remove('completed');
                step3.classList.remove('active', 'completed');
            }
        }
        
        updateWizardContent();
    }
    
    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    function updateSignaturePreview() {
        // Не используется, но оставляем для совместимости
    }
    
    if (generateCertBtn) {
        generateCertBtn.addEventListener('click', generateCertificate);
    }
    
    // Обработчики для автообновления
    const inputs = [certRankText, certSurname, certName, certPatronymic, certPosition, certNumber, certAccount, certDepartment, certIssueDate, certSignature];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('input', function() {
                if (input.id === 'certNumber') {
                    let val = input.value.replace(/\D/g, '').slice(0, 6);
                    if (val !== input.value) input.value = val;
                }
                if (input.id === 'certAccount') {
                    let val = input.value.replace(/\D/g, '').slice(0, 6);
                    if (val !== input.value) input.value = val;
                }
                clearTimeout(window.certUpdateTimeout);
                window.certUpdateTimeout = setTimeout(generateCertificate, 300);
            });
        }
    });
    
    if (certSignature) {
        certSignature.addEventListener('change', generateCertificate);
    }
    
    window.addEventListener('resize', () => {
        const certCanvas = document.getElementById('certCanvas');
        if (certCanvas && certCanvas.width > 0) fitCanvasToContainer(certCanvas);
    });
    
    document.body.addEventListener('click', function(e) {
        if (e.target.id === 'saveCertBtn') saveCertificate();
    });
    
    // Переопределяем кнопку выбора фото
    const editPhotoBtn = document.getElementById('editPhotoBtn');
    if (editPhotoBtn) {
        const newBtn = editPhotoBtn.cloneNode(true);
        editPhotoBtn.parentNode.replaceChild(newBtn, editPhotoBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPhotoWizard();
        });
    }
    
    window.generateCertificate = generateCertificate;
    
    // При переключении на вкладку удостоверений
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId === 'certificate') {
                setTimeout(() => generateCertificate(), 100);
            }
        });
    });
    
    setTimeout(() => {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'certificate') {
            generateCertificate();
        }
    }, 100);
});
