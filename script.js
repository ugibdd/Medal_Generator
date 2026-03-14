document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('resultCanvas');
    const ctx = canvas.getContext('2d');
    
    const genderSelect = document.getElementById('gender');
    const serviceSelect = document.getElementById('service');
    const rankSelect = document.getElementById('rank');
    
    const imageCache = {
        person: null,
        medals: {}
    };
    
    document.getElementById('generateBtn').addEventListener('click', generateImage);
    document.getElementById('saveBtn').addEventListener('click', saveImage);
    
    function updateAvailableOptions() {
        const gender = genderSelect.value;
        const rank = rankSelect.value;
        const isGeneral = isGeneralRank(rank);
        
        const currentService = serviceSelect.value;
        
        serviceSelect.innerHTML = '';
        
        let availableServices = [];
        
        if (gender === 'female') {
            availableServices = [
                { value: 'police', text: 'Полиция' },
                { value: 'justice', text: 'Юстиция' }
            ];
        } else {
            availableServices = [
                { value: 'police', text: 'Полиция' },
                { value: 'vnz', text: 'ВНГ', disabled: true }, // ВНГ выключено
                { value: 'justice', text: 'Юстиция' }
            ];
        }
        
        availableServices.forEach(service => {
            const option = document.createElement('option');
            option.value = service.value;
            option.textContent = service.text;
            
            if (service.disabled) {
                option.disabled = true;
            }
            
            serviceSelect.appendChild(option);
        });
        
        if (availableServices.some(s => s.value === currentService && !s.disabled)) {
            serviceSelect.value = currentService;
        } else {
            const firstAvailable = Array.from(serviceSelect.options).find(opt => !opt.disabled);
            if (firstAvailable) {
                serviceSelect.value = firstAvailable.value;
            }
        }
        
        updateRanksAvailability();
        
        const currentRank = rankSelect.value;
        const isJuniorRank = ['ryadovoy', 'serzhant', 'starshina', 'praporshchik'].includes(currentRank);
        const service_ = serviceSelect.value;
        
        if (service_ !== 'police' && (isGeneralRank(currentRank) || isJuniorRank)) {
            const firstAvailable = Array.from(rankSelect.options).find(opt => !opt.disabled);
            if (firstAvailable) {
                rankSelect.value = firstAvailable.value;
            }
        }
    }
    
    function updateRanksAvailability() {
        const service = serviceSelect.value;
        const currentRank = rankSelect.value;
        
        const rankOptions = Array.from(rankSelect.options);
        
        rankOptions.forEach(option => {
            const rankValue = option.value;
            const isGeneral = isGeneralRank(rankValue);
            
            const isJuniorRank = ['ryadovoy', 'serzhant', 'starshina', 'praporshchik'].includes(rankValue);
            
            if (service !== 'police') {
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
            
            img.onload = () => {
                resolve(img);
            };
            
            img.onerror = () => {
                const img2 = new Image();
                img2.onload = () => resolve(img2);
                img2.onerror = () => reject(new Error(`Не удалось загрузить: ${src}`));
                img2.src = src + '?nocache=' + Date.now(); 
            };
            
            img.src = src + '?nocache=' + Date.now();
        });
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
                link.download = 'dostka-pocheta.png';
                link.href = dataURL;
                link.click();
            } catch (e) {
                
                const dataURL = canvas.toDataURL('image/png');
                const newWindow = window.open();
                newWindow.document.write('<img src="' + dataURL + '" alt="Доска почёта"/>');
                newWindow.document.write('<p>Нажмите правой кнопкой мыши на изображение и выберите "Сохранить картинку как..."</p>');
            }
            
        } catch (error) {
            alert('Не удалось сохранить изображение. Попробуйте сделать скриншот.');
        }
    }
    
    async function generateImage() {
        const gender = genderSelect.value;
        const service = serviceSelect.value;
        const rank = rankSelect.value;
        const medalType = document.getElementById('medalType').value;
        
        const checkboxes = document.querySelectorAll('#medalsList input:checked');
        const selectedMedals = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedMedals.length === 0) {
            alert('Выберите хотя бы одну медаль');
            return;
        }
        
        try {
            canvas.style.opacity = '0.5';
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const personPhotoPath = `img/persons/${gender}/${service}/${rank}.png`;
            
            const personImg = await loadImage(personPhotoPath);
            
            canvas.width = personImg.width;
            canvas.height = personImg.height;
            
            ctx.drawImage(personImg, 0, 0);
            
            const positions = getPositions(gender, service, rank, medalType);
            
            if (!positions) {
                throw new Error(`Нет координат для ${gender}/${service}/${rank} с типом ${medalType}`);
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
                    }
                }
            }
            
            canvas.style.opacity = '1';
            
        } catch (error) {
            alert(`Ошибка: ${error.message}. Проверьте пути к файлам.`);
            canvas.style.opacity = '1';
        }
    }
    
    function distributeMedals(selectedMedals, medalType) {
        const hasHero = selectedMedals.includes('hero');
        const otherMedals = selectedMedals.filter(m => m !== 'hero');
        
        const sortedByImportance = [...otherMedals].sort((a, b) => {
            return MEDAL_HIERARCHY.indexOf(b) - MEDAL_HIERARCHY.indexOf(a);
        });
        

        const distribution = [];

        if (hasHero) {
            distribution.push({
                medal: 'hero',
                position: 'hero'
            });
        }

        if (medalType === 'ribbons') {
            sortedByImportance.forEach((medal, index) => {
                const position = (index + 1).toString();
                distribution.push({
                    medal: medal,
                    position: position
                });
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
                    distribution.push({
                        medal: medal,
                        position: positionsToUse[index]
                    });
                }
            });
        }
        
        return distribution;
    }

    genderSelect.addEventListener('change', function() {
        updateAvailableOptions();
        debounceGenerate();
    });
    
    serviceSelect.addEventListener('change', function() {
        updateRanksAvailability();
        debounceGenerate();
    });
    
    rankSelect.addEventListener('change', function() {
        updateAvailableOptions(); 
        debounceGenerate();
    });

    function debounceGenerate() {
        clearTimeout(window.generateTimeout);
        window.generateTimeout = setTimeout(() => {
            if (document.querySelectorAll('#medalsList input:checked').length > 0) {
                generateImage();
            }
        }, 500);
    }

    const checkboxes = document.querySelectorAll('#medalsList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', debounceGenerate);
    });

    updateAvailableOptions();

    document.getElementById('medalType').addEventListener('change', debounceGenerate);

    document.getElementById('generateBtn').addEventListener('click', function() {
        if (document.querySelectorAll('#medalsList input:checked').length > 0) {
            generateImage();
        } else {
            alert('Выберите хотя бы одну медаль');
        }
    });
});