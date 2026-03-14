document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('resultCanvas');
    const ctx = canvas.getContext('2d');
    
    // Элементы формы
    const genderSelect = document.getElementById('gender');
    const serviceSelect = document.getElementById('service');
    const rankSelect = document.getElementById('rank');
    
    // Хранилище для загруженных изображений
    const imageCache = {
        person: null,
        medals: {}
    };
    
    // Обработчики событий
    document.getElementById('generateBtn').addEventListener('click', generateImage);
    document.getElementById('saveBtn').addEventListener('click', saveImage);
    
    // Функция обновления доступных опций в зависимости от выбранных параметров
    function updateAvailableOptions() {
        const gender = genderSelect.value;
        const rank = rankSelect.value;
        const isGeneral = isGeneralRank(rank);
        
        // Сохраняем текущее выбранное значение службы
        const currentService = serviceSelect.value;
        
        // Очищаем текущие опции
        serviceSelect.innerHTML = '';
        
        // Определяем доступные службы
        let availableServices = [];
        
        if (gender === 'female') {
            // Для женщин доступны только полиция и юстиция
            availableServices = [
                { value: 'police', text: 'Полиция' },
                { value: 'justice', text: 'Юстиция' }
            ];
        } else {
            // Для мужчин доступны все службы
            availableServices = [
                { value: 'police', text: 'Полиция' },
                { value: 'vnz', text: 'ВНГ' },
                { value: 'justice', text: 'Юстиция' }
            ];
        }
        
        // Заполняем select служб
        availableServices.forEach(service => {
            const option = document.createElement('option');
            option.value = service.value;
            option.textContent = service.text;
            serviceSelect.appendChild(option);
        });
        
        // Пытаемся восстановить предыдущее значение, если оно доступно
        if (availableServices.some(s => s.value === currentService)) {
            serviceSelect.value = currentService;
        }
        
        // Обновляем доступные звания
        updateRanksAvailability();
        
        // Проверяем, если текущее звание не подходит для выбранной службы,
        // автоматически выбираем подходящее
        const currentRank = rankSelect.value;
        const isJuniorRank = ['ryadovoy', 'serzhant', 'starshina', 'praporshchik'].includes(currentRank);
        const service_ = serviceSelect.value;
        
        if (service_ !== 'police' && (isGeneralRank(currentRank) || isJuniorRank)) {
            // Выбираем первое доступное звание (лейтенант)
            const firstAvailable = Array.from(rankSelect.options).find(opt => !opt.disabled);
            if (firstAvailable) {
                rankSelect.value = firstAvailable.value;
            }
        }
    }
    
    // Функция обновления доступных званий
    function updateRanksAvailability() {
        const service = serviceSelect.value;
        const currentRank = rankSelect.value;
        
        // Получаем все опции званий
        const rankOptions = Array.from(rankSelect.options);
        
        rankOptions.forEach(option => {
            const rankValue = option.value;
            const isGeneral = isGeneralRank(rankValue);
            
            // Проверяем, является ли звание младше лейтенанта (рядовой, сержант, старшина, прапорщик)
            const isJuniorRank = ['ryadovoy', 'serzhant', 'starshina', 'praporshchik'].includes(rankValue);
            
            // Если служба не полиция:
            if (service !== 'police') {
                // Для ВНГ и юстиции:
                // - Генеральские звания недоступны
                // - Младшие звания (до лейтенанта) недоступны
                if (isGeneral || isJuniorRank) {
                    option.disabled = true;
                    option.style.color = '#999';
                } else {
                    option.disabled = false;
                    option.style.color = '';
                }
            } else {
                // Для полиции:
                // - Генеральские звания доступны
                // - Все звания доступны
                option.disabled = false;
                option.style.color = '';
            }
        });
        
        // Если текущее выбранное звание недоступно, выбираем первое доступное
        if (rankSelect.selectedOptions[0] && rankSelect.selectedOptions[0].disabled) {
            const firstAvailable = Array.from(rankSelect.options).find(opt => !opt.disabled);
            if (firstAvailable) {
                rankSelect.value = firstAvailable.value;
            }
        }
    }
    
    // Функция проверки, является ли звание генеральским
    function isGeneralRank(rank) {
        return GENERAL_RANKS.includes(rank);
    }
    
    // Функция получения координат в зависимости от типа наград
    function getPositions(gender, service, rank, medalType) {
        const rankType = isGeneralRank(rank) ? 'general' : 'regular';
        
        // Выбираем нужный набор координат в зависимости от типа наград
        if (medalType === 'ribbons') {
            return RIBBON_POSITIONS[gender]?.[service]?.[rankType];
        } else {
            return MEDAL_POSITIONS[gender]?.[service]?.[rankType];
        }
    }
    
    // Функция для загрузки изображения с правильной обработкой CORS
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            // Важно: устанавливаем crossOrigin атрибут
            img.crossOrigin = 'Anonymous';
            
            img.onload = () => {
                resolve(img);
            };
            
            img.onerror = () => {
                // Если не удалось загрузить с crossOrigin, пробуем без него
                console.warn('Не удалось загрузить с crossOrigin, пробуем без:', src);
                const img2 = new Image();
                img2.onload = () => resolve(img2);
                img2.onerror = () => reject(new Error(`Не удалось загрузить: ${src}`));
                img2.src = src + '?nocache=' + Date.now(); // Добавляем параметр для избежания кэширования
            };
            
            // Добавляем параметр для избежания кэширования
            img.src = src + '?nocache=' + Date.now();
        });
    }
    
    // Альтернативный метод сохранения через создание ссылки
    function saveImage() {
        try {
            // Проверяем, есть ли что сохранять
            if (canvas.width === 0 || canvas.height === 0) {
                alert('Сначала сгенерируйте изображение');
                return;
            }
            
            // Создаем временный канвас для сохранения
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Копируем содержимое оригинального канваса
            tempCtx.drawImage(canvas, 0, 0);
            
            // Пытаемся сохранить
            try {
                const dataURL = tempCanvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'dostka-pocheta.png';
                link.href = dataURL;
                link.click();
                console.log('Изображение сохранено');
            } catch (e) {
                console.error('Ошибка при экспорте:', e);
                
                // Альтернативный метод: открываем изображение в новой вкладке
                const dataURL = canvas.toDataURL('image/png');
                const newWindow = window.open();
                newWindow.document.write('<img src="' + dataURL + '" alt="Доска почёта"/>');
                newWindow.document.write('<p>Нажмите правой кнопкой мыши на изображение и выберите "Сохранить картинку как..."</p>');
            }
            
        } catch (error) {
            console.error('Ошибка при сохранении:', error);
            alert('Не удалось сохранить изображение. Попробуйте сделать скриншот.');
        }
    }
    
    // Основная функция генерации изображения
    async function generateImage() {
        // Получаем выбранные параметры
        const gender = genderSelect.value;
        const service = serviceSelect.value;
        const rank = rankSelect.value;
        const medalType = document.getElementById('medalType').value;
        
        // Получаем выбранные медали
        const checkboxes = document.querySelectorAll('#medalsList input:checked');
        const selectedMedals = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedMedals.length === 0) {
            alert('Выберите хотя бы одну медаль');
            return;
        }
        
        try {
            // Показываем индикатор загрузки
            canvas.style.opacity = '0.5';
            
            // Очищаем канвас
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Формируем путь к фото сотрудника
            const personPhotoPath = `img/persons/${gender}/${service}/${rank}.png`;
            console.log('Загружаем фото:', personPhotoPath);
            
            // Загружаем фото сотрудника
            const personImg = await loadImage(personPhotoPath);
            
            // Устанавливаем размер канваса равным размеру фото
            canvas.width = personImg.width;
            canvas.height = personImg.height;
            
            // Рисуем фото сотрудника
            ctx.drawImage(personImg, 0, 0);
            
            // Получаем координаты для текущих параметров
            const positions = getPositions(gender, service, rank, medalType);
            
            if (!positions) {
                throw new Error(`Нет координат для ${gender}/${service}/${rank} с типом ${medalType}`);
            }
            
            // Получаем распределение медалей по позициям
            const distribution = distributeMedals(selectedMedals, medalType);
            
            console.log('Распределение медалей по позициям:', distribution);
            
            // Рисуем медали в порядке от САМОЙ НЕВАЖНОЙ к САМОЙ ВАЖНОЙ
            const drawOrder = [...MEDAL_HIERARCHY];
            
            // Загружаем и рисуем все медали
            for (const medalName of drawOrder) {
                const medalItem = distribution.find(item => item.medal === medalName);
                
                if (medalItem) {
                    try {
                        const medalPath = MEDAL_FILES[medalType][medalItem.medal];
                        const medalImg = await loadImage(medalPath);
                        const pos = positions[medalItem.position];
                        
                        if (pos) {
                            ctx.drawImage(medalImg, pos[0], pos[1]);
                            console.log(`Рисуем ${medalName} на позиции ${medalItem.position}`);
                        }
                    } catch (medalError) {
                        console.error(`Ошибка загрузки медали ${medalItem.medal}:`, medalError);
                    }
                }
            }
            
            canvas.style.opacity = '1';
            
        } catch (error) {
            console.error('Ошибка при загрузке изображений:', error);
            alert(`Ошибка: ${error.message}. Проверьте пути к файлам.`);
            canvas.style.opacity = '1';
        }
    }
    
    // Функция распределения медалей по позициям
    function distributeMedals(selectedMedals, medalType) {
        // Отделяем Героя от остальных медалей
        const hasHero = selectedMedals.includes('hero');
        const otherMedals = selectedMedals.filter(m => m !== 'hero');
        
        // Для распределения ПО ПОЗИЦИЯМ сортируем от САМОЙ ВАЖНОЙ к САМОЙ НЕВАЖНОЙ
        const sortedByImportance = [...otherMedals].sort((a, b) => {
            return MEDAL_HIERARCHY.indexOf(b) - MEDAL_HIERARCHY.indexOf(a);
        });
        
        console.log('Сортировка для позиций (от важной к неважной):', sortedByImportance);
        
        // Создаем массив с распределением
        const distribution = [];
        
        // Добавляем Героя если есть (всегда на своей позиции)
        if (hasHero) {
            distribution.push({
                medal: 'hero',
                position: 'hero'
            });
        }
        
        // Для планок - всегда с первой позиции подряд
        if (medalType === 'ribbons') {
            sortedByImportance.forEach((medal, index) => {
                const position = (index + 1).toString();
                distribution.push({
                    medal: medal,
                    position: position
                });
            });
        } else {
            // Для медалей - используем правила распределения
            let positionsToUse;
            if (sortedByImportance.length >= 4) {
                positionsToUse = POSITION_RULES['4+'];
            } else {
                positionsToUse = POSITION_RULES[sortedByImportance.length] || [];
            }
            
            console.log('Используем позиции:', positionsToUse);
            
            // Распределяем остальные медали по позициям
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
    
    // Слушатели изменений для обновления доступных опций
    genderSelect.addEventListener('change', function() {
        updateAvailableOptions();
        // Автоматически генерируем при изменении
        debounceGenerate();
    });
    
    serviceSelect.addEventListener('change', function() {
        updateRanksAvailability();
        debounceGenerate();
    });
    
    rankSelect.addEventListener('change', function() {
        updateAvailableOptions(); // Обновляем доступные службы при смене звания
        debounceGenerate();
    });
    
    // Функция для debounce генерации
    function debounceGenerate() {
        clearTimeout(window.generateTimeout);
        window.generateTimeout = setTimeout(() => {
            if (document.querySelectorAll('#medalsList input:checked').length > 0) {
                generateImage();
            }
        }, 500);
    }
    
    // Автоматически генерируем изображение при изменении чекбоксов
    const checkboxes = document.querySelectorAll('#medalsList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', debounceGenerate);
    });
    
    // Инициализация при загрузке
    updateAvailableOptions();
    
    // Добавляем обработчик для типа наград
    document.getElementById('medalType').addEventListener('change', debounceGenerate);
    
    // Также добавляем обработчик для кнопки генерации
    document.getElementById('generateBtn').addEventListener('click', function() {
        if (document.querySelectorAll('#medalsList input:checked').length > 0) {
            generateImage();
        } else {
            alert('Выберите хотя бы одну медаль');
        }
    });
});