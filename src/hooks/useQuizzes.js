import { useState, useEffect } from 'react';
import api from '../services/api';

const useQuizzes = () => {
    const [quizzes, setQuizzes] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = async () => {
      console.log('🔄 Iniciando busca de questionários...');
      setLoading(true);
      setError(null);
      
      try {
        console.log('📡 Fazendo requisição para /Questionarios...');
        const result = await api.get('/Questionarios');
        
        console.log('✅ Questionários carregados com sucesso:', {
          count: result.data?.length || 0,
          data: result.data
        });
        
        setQuizzes(result.data);
        setError(null);
        
      } catch (error) {
        console.error('❌ Erro ao carregar questionários:', error);
        
        // Tratamento específico de erros
        let errorMessage = 'Erro desconhecido ao carregar questionários';
        
        if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e se o servidor está online.';
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          errorMessage = 'Timeout na conexão. O servidor demorou muito para responder.';
        } else if (error.response?.status === 404) {
          errorMessage = 'Rota de questionários não encontrada no servidor.';
        } else if (error.response?.status === 500) {
          errorMessage = 'Erro interno do servidor ao buscar questionários.';
        } else if (error.response?.status) {
          errorMessage = `Erro do servidor: ${error.response.status} - ${error.response.statusText}`;
        }
        
        setError({
          message: errorMessage,
          originalError: error.message,
          code: error.code,
          status: error.response?.status
        });
        
        setQuizzes(null);
      } finally {
        setLoading(false);
        console.log('🏁 Busca de questionários finalizada');
      }
    }

    // const fetchQuizById = async (id) => {
    //   try {
    //       const result = await api.get(`/quizzes/${id}`);
    //       return result.data;
    //   } catch (error) {
    //       console.error('Error fetching quiz:', error);
    //       return null;
    //   }
    // };

    const fetchQuizById = async (id) => {
      try {
          const result = await quizzes.find(quiz => quiz.idQuestao === id);
          return result.data;
      } catch (error) {
          console.error('Error fetching quiz:', error);
          return null;
      }
    };

    const createNewQuiz = async (newQuiz) => {
      try {
          const result = await api.post('/quizzes', newQuiz);
          setQuizzes((prevQuizzes) => [...prevQuizzes, result.data]);
          return result.data;
      } catch (error) {
          console.error('Error adding quiz:', error);
          return null;
      }
  };

    useEffect(() => {
        console.log('🚀 useQuizzes: Componente montado, iniciando busca de questionários...');
        fetchData();
    }, []);

    return { 
        quizzes, 
        loading, 
        error, 
        refetch: fetchData, 
        fetchQuizById, 
        createNewQuiz 
    };
}

export default useQuizzes;