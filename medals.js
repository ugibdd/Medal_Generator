document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('resultCanvas');
    const ctx = canvas.getContext('2d');
    
    const genderSelect = document.getElementById('gender');
    const serviceSelect = document.getElementById('service');
    const rankSelect = document.getElementById('rank');
    const vnzUniformSelect = document.getElementById('vnzUniform');
    const vnzUniformGroup = document.getElementById('vnzUniformGroup');
    const medalTypeSelect = document.getElementById('medalType');
    const medalTypeGroup = medalTypeSelect.closest('.control-group');
    
    let chevronText = '';
    
    function addChevronTextInput() {
        if (document.getElementById('chevronTextGroup')) return;
        
        const chevronGroup = document.createElement('div');
        chevronGroup.className = 'control-group';
        chevronGroup.id = 'chevronTextGroup';
        chevronGroup.innerHTML = `
            <label>Текст на шевроне:</label>
            <input type="text" id="chevronText" maxlength="50" placeholder="Введите текст..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #2a2f3a; background: #0f1115; color: #e6e6e6; font-size: 14px;">
        `;
        
        medalTypeGroup.insertAdjacentElement('afterend', chevronGroup);
        
        document.getElementById('chevronText').addEventListener('input', function(e) {
            chevronText = e.target.value;
            debounceGenerate();
        });
    }
    
    function removeChevronTextInput() {
        const chevronGroup = document.getElementById('chevronTextGroup');
        if (chevronGroup) {
            chevronGroup.remove();
            chevronText = '';
        }
    }
    
    function updateMedalTypeVisibility() {
        const service = serviceSelect.value;
        const vnzUniform = vnzUniformSelect ? vnzUniformSelect.value : 'office';
        
        if (service === 'vnz') {
            medalTypeGroup.style.display = 'none';
            
            if (vnzUniform === 'office') {
                medalTypeSelect.value = 'ribbons';
                addChevronTextInput();
            } else if (vnzUniform === 'parade') {
                medalTypeSelect.value = 'full';
                removeChevronTextInput();
            }
        } else {
            medalTypeGroup.style.display = 'block';
            medalTypeSelect.disabled = false;
            medalTypeSelect.style.opacity = '1';
            medalTypeSelect.style.cursor = 'pointer';
            removeChevronTextInput();
        }
    }
    
    function updateAvailableOptions() {
        if (serviceSelect.value === 'vnz') {
            vnzUniformGroup.style.display = 'block';
            updateMedalTypeVisibility();
        } else {
            vnzUniformGroup.style.display = 'none';
            removeChevronTextInput();
            medalTypeGroup.style.display = 'block';
            medalTypeSelect.disabled = false;
            medalTypeSelect.style.opacity = '1';
            medalTypeSelect.style.cursor = 'pointer';
        }
    }
    
    function getAvailableRanksForService(service) {
        if (service === 'vnz') {
            return VNZ_AVAILABLE_RANKS;
        } else if (service === 'justice') {
            return ['leytenant', 'starlyeytenant', 'kapitan', 'mayor', 'podpolkovnik', 'polkovnik'];
        } else {
            return Array.from(rankSelect.options).map(opt => opt.value);
        }
    }
    
    function updateRanksAvailability() {
        const service = serviceSelect.value;
        const rankOptions = Array.from(rankSelect.options);
        
        rankOptions.forEach(option => {
            const rankValue = option.value;
            const isGeneral = GENERAL_RANKS.includes(rankValue);
            const isJuniorRank = ['ryadovoy', 'serzhant', 'starshina', 'praporshchik'].includes(rankValue);
            
            if (service === 'vnz') {
                if (VNZ_AVAILABLE_RANKS.includes(rankValue)) {
                    option.disabled = false;
                    option.style.color = '';
                } else {
                    option.disabled = true;
                    option.style.color = '#999';
                }
            } else if (service === 'justice') {
                if (isGeneral || isJuniorRank) {
                    option.disabled = true;
                    option.style.color = '#999';
                } else {
                    option.disabled = false;
                    option.style.color = '';
                }
            } else {
                option.disabled = false;
                option.style.color = '';
            }
        });
        
        if (rankSelect.selectedOptions[0] && rankSelect.selectedOptions[0].disabled) {
            const firstAvailable = Array.from(rankSelect.options).find(opt => !opt.disabled);
            if (firstAvailable) {
                rankSelect.value = firstAvailable.value;
            }
        }
    }
    
    function isGeneralRank(rank) {
        return GENERAL_RANKS.includes(rank);
    }
    
    function getPositions(gender, service, rank, medalType) {
        const rankType = isGeneralRank(rank) ? 'general' : 'regular';
        
        if (medalType === 'ribbons') {
            return RIBBON_POSITIONS[gender]?.[service]?.[rankType];
        } else {
            return MEDAL_POSITIONS[gender]?.[service]?.[rankType];
        }
    }
    
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => {
                const img2 = new Image();
                img2.onload = () => resolve(img2);
                img2.onerror = () => reject(new Error(`Не удалось загрузить: ${src}`));
                img2.src = src + '?nocache=' + Date.now();
            };
            img.src = src + '?nocache=' + Date.now();
        });
    }
    
    function drawChevronText(ctx, text, positions) {
        if (!text || !positions || !positions.chevronText) return;
        
        const chevronPos = positions.chevronText;
        
        ctx.save();
        ctx.translate(chevronPos.x, chevronPos.y);
        ctx.rotate(chevronPos.rotation);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#d0d3d4';
        
        let fontSize = 38.5;
        const minFontSize = 10;
        const fontFamily = 'Arial Narrow Bold, Arial Narrow, Arial, sans-serif';
        
        function getTextWidth(text, size) {
            ctx.font = `${size}px ${fontFamily}`;
            return ctx.measureText(text).width;
        }
        
        while (fontSize > minFontSize && getTextWidth(text, fontSize) > chevronPos.maxWidth) {
            fontSize -= 0.1;
        }
        
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }
    
    function distributeMedals(selectedMedals, medalType) {
        const hasHero = selectedMedals.includes('hero');
        const otherMedals = selectedMedals.filter(m => m !== 'hero');
        
        const sortedByImportance = [...otherMedals].sort((a, b) => {
            return MEDAL_HIERARCHY.indexOf(b) - MEDAL_HIERARCHY.indexOf(a);
        });
        
        const distribution = [];
        
        if (hasHero) {
            distribution.push({ medal: 'hero', position: 'hero' });
        }
        
        if (medalType === 'ribbons') {
            sortedByImportance.forEach((medal, index) => {
                distribution.push({ medal: medal, position: (index + 1).toString() });
            });
        } else {
            let positionsToUse;
            if (sortedByImportance.length >= 4) {
                positionsToUse = POSITION_RULES['4+'];
            } else {
                positionsToUse = POSITION_RULES[sortedByImportance.length] || [];
            }
            
            sortedByImportance.forEach((medal, index) => {
                if (index < positionsToUse.length) {
                    distribution.push({ medal: medal, position: positionsToUse[index] });
                }
            });
        }
        
        return distribution;
    }
    
    async function generateImage() {
        const gender = genderSelect.value;
        const service = serviceSelect.value;
        const rank = rankSelect.value;
        const medalType = medalTypeSelect.value;
        const vnzUniform = vnzUniformSelect ? vnzUniformSelect.value : 'office';
        
        if (service === 'vnz') {
            if (vnzUniform === 'office' && medalType !== 'ribbons') {
                alert('Для офисной формы ВНГ доступны только планки');
                medalTypeSelect.value = 'ribbons';
                return generateImage();
            }
            if (vnzUniform === 'parade' && medalType !== 'full') {
                alert('Для парадной формы ВНГ доступны только медали');
                medalTypeSelect.value = 'full';
                return generateImage();
            }
        }
        
        const checkboxes = document.querySelectorAll('#medalsList input:checked');
        const selectedMedals = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedMedals.length === 0) {
            alert('Выберите хотя бы одну медаль');
            return;
        }
        
        try {
            canvas.style.opacity = '0.5';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let personPhotoPath;
            if (service === 'vnz') {
                personPhotoPath = `img/persons/${gender}/${service}/${vnzUniform}/${rank}.png`;
            } else {
                personPhotoPath = `img/persons/${gender}/${service}/${rank}.png`;
            }
            
            const personImg = await loadImage(personPhotoPath);
            
            canvas.width = personImg.width;
            canvas.height = personImg.height;
            ctx.drawImage(personImg, 0, 0);
            
            const positions = getPositions(gender, service, rank, medalType);
            
            if (!positions) {
                throw new Error(`Нет координат для ${gender}/${service}/${rank} с типом ${medalType}`);
            }
            
            if (service === 'vnz' && vnzUniform === 'office' && chevronText) {
                drawChevronText(ctx, chevronText, positions);
            }
            
            const distribution = distributeMedals(selectedMedals, medalType);
            
            const drawOrder = [...MEDAL_HIERARCHY];
            
            for (const medalName of drawOrder) {
                const medalItem = distribution.find(item => item.medal === medalName);
                
                if (medalItem) {
                    try {
                        const medalPath = MEDAL_FILES[medalType][medalItem.medal];
                        const medalImg = await loadImage(medalPath);
                        const pos = positions[medalItem.position];
                        if (pos) {
                            ctx.drawImage(medalImg, pos[0], pos[1]);
                        }
                    } catch (medalError) {
                        console.warn(`Не удалось загрузить медаль: ${medalItem.medal}`, medalError);
                    }
                }
            }
            
            canvas.style.opacity = '1';
        } catch (error) {
            alert(`Ошибка: ${error.message}. Проверьте пути к файлам.`);
            canvas.style.opacity = '1';
        }
    }
    
    function saveImage() {
        try {
            if (canvas.width === 0 || canvas.height === 0) {
                alert('Сначала сгенерируйте изображение');
                return;
            }
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);
            
            try {
                const dataURL = tempCanvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'doska-pochyota.png';
                link.href = dataURL;
                link.click();
            } catch (e) {
                const dataURL = canvas.toDataURL('image/png');
                const newWindow = window.open();
                newWindow.document.write('<img src="' + dataURL + '" alt="Доска почёта"/>');
            }
        } catch (error) {
            alert('Не удалось сохранить изображение. Попробуйте сделать скриншот.');
        }
    }
    
    function debounceGenerate() {
        clearTimeout(window.generateTimeout);
        window.generateTimeout = setTimeout(() => {
            if (document.querySelectorAll('#medalsList input:checked').length > 0) {
                generateImage();
            }
        }, 500);
    }
    
    genderSelect.addEventListener('change', function() {
        updateAvailableOptions();
        debounceGenerate();
    });
    
    serviceSelect.addEventListener('change', function() {
        updateRanksAvailability();
        if (serviceSelect.value === 'vnz') {
            vnzUniformGroup.style.display = 'block';
            updateMedalTypeVisibility();
        } else {
            vnzUniformGroup.style.display = 'none';
            removeChevronTextInput();
            medalTypeGroup.style.display = 'block';
            medalTypeSelect.disabled = false;
            medalTypeSelect.style.opacity = '1';
            medalTypeSelect.style.cursor = 'pointer';
        }
        debounceGenerate();
    });
    
    rankSelect.addEventListener('change', function() {
        debounceGenerate();
    });
    
    if (vnzUniformSelect) {
        vnzUniformSelect.addEventListener('change', function() {
            updateMedalTypeVisibility();
            debounceGenerate();
        });
    }
    
    const checkboxes = document.querySelectorAll('#medalsList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', debounceGenerate);
    });
    
    medalTypeSelect.addEventListener('change', debounceGenerate);
    
    document.getElementById('generateBtn').addEventListener('click', function() {
        if (document.querySelectorAll('#medalsList input:checked').length > 0) {
            generateImage();
        } else {
            alert('Выберите хотя бы одну медаль');
        }
    });
    
    document.getElementById('saveBtn').addEventListener('click', saveImage);
    
    if (serviceSelect.value === 'vnz') {
        vnzUniformGroup.style.display = 'block';
        updateMedalTypeVisibility();
    }
    
    updateRanksAvailability();
});