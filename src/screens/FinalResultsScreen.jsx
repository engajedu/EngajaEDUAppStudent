import { useEffect, useState } from 'react';
import { useNavigation } from "@react-navigation/native";
import { useTheme, ActivityIndicator, Button, Text } from 'react-native-paper';
import GradientBackground from '../components/GradientBackground';

import api from '../services/api';
import useQuizStore from '../stores/QuizStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlatList, View } from 'react-native';
import useStyles from '../hooks/useStyles';

export default function FinalResultsScreen() {
    const [matricula, setMatricula] = useState(null);
    const [hasMatricula, setHasMatricula] = useState(false);
    const [podiumReceived, setPodiumReceived] = useState(false);
    const [students, setStudents] = useState([]);
    const [intervalId, setIntervalId] = useState(null);
    const [userCorrectAnswers, setUserCorrectAnswers] = useState(0); // NOVO

    const [quizCode, setQuizCode] = useState(null);
    const [hasQuizCode, setHasQuizCode] = useState(false);

    const navigation = useNavigation();
    const quiz = useQuizStore((state) => state.quiz);

    const results = useQuizStore((state) => state.results);
    const reset = useQuizStore((state) => state.reset);
    const theme = useTheme();
    const styles = useStyles();

    useEffect(() => {
        const getMatricula = async () => {
            try {
                const value = await AsyncStorage.getItem('matricula');
                if (value !== null) {
                    setMatricula(value);
                    setHasMatricula(true);
                }
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

        async function finishQuiz() {
            try {
                await api.post('/conectarAluno', JSON.stringify({
                    matricula: Number(matricula),
                    codigo: quizCode
                }));

          
                try {
                    const response = await api.get('/retornaPodio');
                    const meusDados = response.data.find(aluno => 
                        aluno.matricula.toString() === matricula?.toString()
                    );
                    if (meusDados) {
                        setUserCorrectAnswers(meusDados.pontuacao); 
                    }
                } catch (error) {
                    console.error('Error getting user position:', error);
                }


                const id = setInterval(async () => {
                    try {
                        const response = await api.get('/retornaPodio');
                        setStudents(response.data);
                        setPodiumReceived(true);
                        
                     
                        
                    } catch (error) {
                        console.error('Error making API call:', error);
                    }
                }, 3000);

                setIntervalId(id);
            } catch (error) {
                console.error('Error making API call:', error);
            }
        }

        finishQuiz();
    }, [hasMatricula, hasQuizCode]);

    const handleEnd = async () => {
        if (intervalId) {
            clearInterval(intervalId);
        }

        await AsyncStorage.removeItem('matricula');
        await AsyncStorage.removeItem('codigo');
        navigation.popToTop();
        reset();
    };

    return (
        <GradientBackground>
            <Text variant='headlineSmall'>Questionário finalizado</Text>
            <Text variant='titleLarge' style={{ marginVertical: 30 }}>
                Você acertou {userCorrectAnswers} de {quiz.questoes.length} questões
            </Text>

            {podiumReceived ? (
                <>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                        <Text variant='headlineMedium' style={{ marginBottom: 10 }}>Top 10 alunos</Text>

                        <FlatList
                            data={students.slice(0, 10)}
                            keyExtractor={(item) => item.matricula.toString()}
                            style={{ maxHeight: 300, width: '90%' }}
                            renderItem={({ item, index }) => {
                                const isSelf = item.matricula.toString() === matricula?.toString();
                                return (
                                    <View
                                        style={{
                                            backgroundColor: isSelf ? theme.colors.secondaryContainer : theme.colors.background,
                                            padding: 10,
                                            borderRadius: 10,
                                            marginBottom: 8,
                                            borderWidth: 1,
                                            borderColor: theme.colors.outline,
                                        }}
                                    >
                                        <Text variant="titleMedium">{index + 1}º - {item.nome}</Text>
                                        <Text>{item.pontuacao} {item.pontuacao === 1 ? 'acerto' : 'acertos'}</Text>
                                        {isSelf && <Text style={{ marginTop: 5 }}>👤 Você</Text>}
                                    </View>
                                );
                            }}
                        />

                        {!students.slice(0, 10).some(s => s.matricula.toString() === matricula?.toString()) && (
                            <Text variant="titleMedium" style={{ marginTop: 20 }}>
                                Sua posição: {
                                    students.findIndex(s => s.matricula.toString() === matricula?.toString()) + 1
                                }º lugar
                            </Text>
                        )}
                    </View>
                </>
            ) : (
                <ActivityIndicator animating={true} size="large" color={theme.colors.primary} style={{ marginVertical: 20 }} />
            )}

            <Button
                mode="contained"
                style={{ padding: 10, marginTop: 30 }}
                onPress={handleEnd}
            >
                Encerrar
            </Button>
        </GradientBackground>
    );
}
