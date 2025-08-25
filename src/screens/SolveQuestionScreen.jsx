import { useEffect, useState, useCallback } from "react";
import { Alert, BackHandler, TouchableOpacity, View, ScrollView } from "react-native";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { useTheme, ActivityIndicator, Button, Text } from "react-native-paper";
import api from '../services/api';
import { CountdownCircleTimer } from 'react-native-countdown-circle-timer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useQuizStore from "../stores/QuizStore";
import useStyles from "../hooks/useStyles";
import getReadingTime from '../utils/getReadingTime'
import GradientBackground from '../components/GradientBackground';
import ProgressBar from "../components/ProgressBar";
import useWebSocket from '../hooks/useWebSocket';

export default function SolveQuestionScreen({ navigation }) {
    const route = useRoute();
    const { quizToSolve } = route.params || { quizToSolve: null };

    const [timer, setTimer] = useState(0);
    const [timeIsOver, setTimeIsOver] = useState(false);
    const [key, setKey] = useState(0);
    const [matricula, setMatricula] = useState(null);
    const [hasMatricula, setHasMatricula] = useState(false);

    const [quizCode, setQuizCode] = useState(null);
    const [hasQuizCode, setHasQuizCode] = useState(false);
    const [posicao, setPosicao] = useState(null);

    const quiz = useQuizStore((state) => state.quiz);
    const currentQuestionIndex = useQuizStore((state) => state.currentQuestionIndex);
    const lastAnswer = useQuizStore((state) => state.lastAnswer);
    const setSelectedAnswer = useQuizStore((state) => state.setSelectedAnswer);
    const computeAnswer = useQuizStore((state) => state.computeAnswer);
    const nextQuestion = useQuizStore((state) => state.nextQuestion);
    const fetchQuiz = useQuizStore((state) => state.fetchQuiz);
    const reset = useQuizStore((state) => state.reset);
    const jumpToQuestion = useQuizStore((state) => state.jumpToQuestion);

    const theme = useTheme();
    const styles = useStyles();
    const socket = useWebSocket();

    useEffect(() => {
        if (quizToSolve) {
            reset();
            fetchQuiz(quizToSolve);
        }
    }, [quizToSolve]);

    useEffect(() => {
        const getMatricula = async () => {
            try {
                const value = await AsyncStorage.getItem('matricula');
                setMatricula(value);
                setHasMatricula(true);
            } catch (e) {
                console.error(e);
            }
        };

        const getQuizCode = async () => {
            try {
                const value = await AsyncStorage.getItem('codigo');
                setQuizCode(value);
                setHasQuizCode(true);
            } catch (e) {
                console.error(e);
            }
        };

        getMatricula();
        getQuizCode();
    }, []);

    useEffect(() => {
        if (!hasMatricula || !hasQuizCode) return;

        async function connect() {
            await api.post('/conectarAluno', JSON.stringify({
                matricula: Number(matricula),
                codigo: quizCode
            }))
            .catch((error) => {
                console.error(error);
            });
        }

        connect();
    }, [currentQuestionIndex, hasMatricula, hasQuizCode]);

    useFocusEffect(
        useCallback(() => {
            setTimeIsOver(false);
            setSelectedAnswer(null);
        }, [])
    );

    useEffect(() => {
        if (quiz && quiz.questoes && quiz.questoes[currentQuestionIndex]) {
            const readingTime = getReadingTime(quiz.questoes[currentQuestionIndex].enunciado);
            setTimer(readingTime);
        }
    }, [currentQuestionIndex, quiz]);

    // ✅ CORRIGIR BackHandler
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                Alert.alert(
                    "Alerta",
                    "Você quer mesmo sair do questionário?",
                    [
                        { text: "Cancelar", onPress: () => null, style: "cancel" },
                        { text: "Sair", onPress: () => navigation.popToTop() }
                    ]
                );
                return true;
            }

            const backHandler = BackHandler.addEventListener(
                'hardwareBackPress',
                onBackPress
            );

            return () => {
                // ✅ CORREÇÃO: Usar o método correto
                if (backHandler?.remove) {
                    backHandler.remove();
                } else {
                    BackHandler.removeEventListener('hardwareBackPress', onBackPress);
                }
            };
        }, [])
    );

    // ✅ CORRIGIR WebSocket listeners
    useEffect(() => {
        if (!socket) return;

        console.log("🎯 Configurando listeners em SolveQuestionScreen");

        const messageHandler = (event) => {
            console.log("📩 Mensagem recebida:", event.data);

            if (event.data === "mostrar-posicao") {
                console.log("🔄 Navegando para IntermediatePosition");
                navigation.navigate('IntermediatePosition');
                return;
            }

            if (event.data === "nova-questao") {
                console.log("📝 Atualizando questão");

                api.get('/retornaQuestaoAtual')
                    .then(response => {
                        const current = response.data;

                        if (current !== currentQuestionIndex) {
                            setSelectedAnswer(null);

                            if (current === quiz.questoes.length) {
                                finishQuiz();
                            } else {
                                for (let i = currentQuestionIndex; i < current; i++) {
                                    computeAnswer(null, quiz.questoes[i].resposta);
                                }

                                setKey(prevKey => prevKey + 1);
                                setTimeIsOver(false);
                                jumpToQuestion(current);
                            }
                        }
                    })
                    .catch(error => console.error("Erro ao sincronizar questão:", error));
            }
        };

        // ✅ CORREÇÃO: Usar onmessage diretamente para React Native
        socket.onmessage = messageHandler;

        console.log("✅ Listeners configurados com sucesso");

        return () => {
            console.log("🧹 Removendo listener de mensagens");
            socket.onmessage = null;
        };
    }, [socket, navigation, currentQuestionIndex, quiz?.questoes]);

    // NOVO useEffect - Mecanismo de polling como backup
    // No useEffect do polling, adicione esta verificação:
useEffect(() => {
    const intervalId = setInterval(() => {
        if (!timeIsOver) return;
        
        console.log("🔄 Verificando próxima questão via polling");
        
        api.get('/retornaQuestaoAtual')
            .then(response => {
                const current = response.data;
                console.log(`Questão atual do servidor: ${current}, local: ${currentQuestionIndex}`);
                
                if (current !== currentQuestionIndex) {
                    setSelectedAnswer(null);
                    
                    // ✅ VERIFICAR se a questão existe
                    if (current >= quiz?.questoes?.length) {
                        console.log("🏁 Questionário finalizado");
                        finishQuiz();
                        return;
                    }
                    
                    // ✅ VERIFICAR se quiz e questões existem
                    if (!quiz?.questoes) {
                        console.error("❌ Quiz não carregado");
                        return;
                    }
                    
                    for (let i = currentQuestionIndex; i < current; i++) {
                        // ✅ VERIFICAR se a questão existe antes de acessar
                        if (quiz.questoes[i]) {
                            computeAnswer(null, quiz.questoes[i].resposta);
                        }
                    }
                    
                    setKey(prevKey => prevKey + 1);
                    setTimeIsOver(false);
                    jumpToQuestion(current);
                }
            })
            .catch(error => {
                console.error("Erro no polling:", error);
            });
    }, 3000);
    
    return () => clearInterval(intervalId);
}, [timeIsOver, currentQuestionIndex, quiz]);

useEffect(() => {
    setPosicao(null); // limpa a posição da questão anterior
}, [currentQuestionIndex]);

useEffect(() => {
    if (!timeIsOver || lastAnswer === null || !matricula) return;

    const timeoutId = setTimeout(() => {
        api.post('/retornaPosicao', { matricula: Number(matricula) })
            .then(response => {
                setPosicao(response.data?.posicao || 'N/A');
            })
            .catch(error => {
                console.error("Erro ao buscar posição:", error);
                setPosicao('Erro');
            });
    }, 3000);

    return () => clearTimeout(timeoutId);
}, [timeIsOver, lastAnswer, matricula, currentQuestionIndex]);

    const finishQuiz = () => {
        computeAnswer(lastAnswer, quiz.questoes[currentQuestionIndex].resposta);
        navigation.navigate('Final');
    };

    const handleAnswer = async (answer) => {
    setSelectedAnswer(answer);

    const questao = quiz.questoes[currentQuestionIndex];
    const respostaCorreta = String(questao.resposta).toLowerCase() === "v";
    const acertou = answer === respostaCorreta;

    const payload = {
        matricula: Number(matricula),
        idQuestao: questao._id ?? currentQuestionIndex,
        acertou: answer === null ? false : acertou,
    };

    try {
        await api.post('/salvaRespostaUnica', payload);

        if (answer !== null && acertou) {
            await api.post('/salvaPontuacao', {
                matricula: Number(matricula),
                acertou: true
            });
        }
    } catch (e) {
        console.error("Erro ao salvar resposta:", e.response?.data || e.message);
    }
};

    return (
        <GradientBackground>
            {
                !quiz ?
                    <ActivityIndicator animating={true} size="large" color={theme.colors.primary} />
                    :
                    <>
                        {
                            !timeIsOver ? (
                                <CountdownCircleTimer
                                    key={key}
                                    isPlaying
                                    duration={timer}
                                    size={120}
                                    strokeWidth={6}
                                    colors={['#663399', '#93000a']}
                                    colorsTime={[timer, 0]}
                                    onComplete={() => {
                                        setTimeIsOver(true);

                                        if (lastAnswer !== null) {
                                            handleAnswer(lastAnswer); 
                                        } else {
                                        handleAnswer(null);
                                        }

                                        return { shouldRepeat: false }; // importante para o timer não reiniciar
                                        }}
                                >
                                    {({ remainingTime }) => <Text variant="titleLarge">{remainingTime}</Text>}
                                </CountdownCircleTimer>
                            ) : (
                                <Text variant="titleLarge">Tempo esgotado</Text>
                            )
                        }

                        <View style={styles.header}>
                            <Text variant="titleMedium">Questão {currentQuestionIndex + 1}</Text>
                            <Text variant="titleMedium">{currentQuestionIndex + 1} / {quiz.questoes.length}</Text>
                        </View>

                        <ProgressBar total={quiz.questoes.length} current={currentQuestionIndex + 1} />

                        {
                            quiz.questoes[currentQuestionIndex].enunciado.length >= 275 ? (
                                <ScrollView style={{ maxHeight: 300, width: '80%', marginVertical: 20 }}>
                                    <Text variant="titleLarge">{quiz.questoes[currentQuestionIndex].enunciado}</Text>
                                </ScrollView>
                            ) : (
                                <Text variant="titleLarge" style={{ marginVertical: 20, width: '80%' }}>
                                    {quiz.questoes[currentQuestionIndex].enunciado}
                                </Text>
                            )
                        }

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                onPress={() => setSelectedAnswer(true)}
                                disabled={timeIsOver}
                                style={[
                                    styles.button,
                                    lastAnswer === true ? styles.containedTrue : styles.outlined(theme.colors.outline),
                                    timeIsOver && styles.disabled,
                                ]}
                            >
                                <Text style={[
                                    styles.text,
                                    lastAnswer === true && styles.containedText,
                                    timeIsOver && styles.disabledText
                                ]}>Verdadeiro</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSelectedAnswer(false)}
                                disabled={timeIsOver}
                                style={[
                                    styles.button,
                                    lastAnswer === false ? styles.containedFalse : styles.outlined(theme.colors.outline),
                                    timeIsOver && styles.disabled,
                                ]}
                            >
                                <Text style={[
                                    styles.text,
                                    lastAnswer === false && styles.containedText,
                                    timeIsOver && styles.disabledText
                                ]}>Falso</Text>
                            </TouchableOpacity>
                        </View>

                        {
                            (timeIsOver && lastAnswer === null) && (
                                <Text variant="titleMedium">Você não respondeu a questão</Text>
                            )
                        }

                        {lastAnswer !== null && (
                            <Text variant="titleMedium">Você selecionou: {lastAnswer ? "Verdadeiro" : "Falso"}</Text>
                        )}

                        {posicao && (
                            <Text variant="titleMedium" style={{ marginTop: 10 }}>
                                Sua posição atual: {posicao}
                            </Text>
                        )}
                        {
                            timeIsOver && (
                                currentQuestionIndex === quiz.questoes.length - 1 ?
                                    <>
                                        <Text variant="titleSmall" style={{ marginVertical: 20 }}>Aguarde a finalização do questionário</Text>
                                        <ActivityIndicator animating={true} size="large" color={theme.colors.primary} />
                                    </>
                                    :
                                    <>
                                        <Text variant="titleSmall" style={{ marginVertical: 20 }}>Aguarde a próxima questão</Text>
                                        <ActivityIndicator animating={true} size="large" color={theme.colors.primary} />
                                    </>
                            )
                        }
                    </>
            }
        </GradientBackground>
    );
}