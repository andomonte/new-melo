import FormInput from '@/components/common/FormInput';
import React from 'react';
import SearchSelectInput from '@/components/common/SearchSelectInput';
import { UsuarioEdit } from '@/data/usuarios/usuarios';
import { Grupos } from '@/data/grupos/grupos';
import { CadUsuarioSearchOptions } from '@/components/corpo/admin/controleAcesso/usuarios/modalCadastrar';

interface DadosCadastraisProps {
  usuario: UsuarioEdit;
  handleUsuarioChange: (field: keyof UsuarioEdit, value: any) => void;
  error?: { [p: string]: string };
  options: { grupos: Grupos };
  handleSearchOptionsChange: (
    option: CadUsuarioSearchOptions,
    value: string,
  ) => void;
  isEdit?: boolean;
}

const DadosCadastrais: React.FC<DadosCadastraisProps> = ({
  usuario,
  handleUsuarioChange,
  error,
  options,
  handleSearchOptionsChange,
  isEdit,
}) => {
  const gruposOptions = options.grupos.data.map((grupo) => ({
    value: grupo.LOGIN_GROUP_NAME,
    label: grupo.LOGIN_GROUP_NAME,
  }));

  return (
    <form>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormInput
          name="login_user_login"
          type="text"
          label="Login"
          defaultValue={usuario.login_user_login || ''}
          onChange={(e) =>
            handleUsuarioChange('login_user_login', e.target.value)
          }
          error={error?.login_user_login}
          required
        />
        <FormInput
          name="login_user_password"
          type="password"
          label="Senha"
          onChange={(e) =>
            handleUsuarioChange('login_user_password', e.target.value)
          }
          error={error?.login_user_password}
          {...(usuario.login_user_login && isEdit
            ? { disabled: true, required: false }
            : { required: true })}
        />
        <FormInput
          name="login_user_name"
          type="text"
          label="Nome"
          defaultValue={usuario.login_user_name || ''}
          onChange={(e) =>
            handleUsuarioChange('login_user_name', e.target.value)
          }
          error={error?.login_user_name}
          required
        />
        <SearchSelectInput
          name="login_group_name"
          label="Grupo de Usuário"
          options={gruposOptions}
          defaultValue={usuario.login_group_name || ''}
          onValueChange={(value) =>
            handleUsuarioChange('login_group_name', value.toString())
          }
          onInputChange={(value) => {
            handleSearchOptionsChange('grupo', value);
          }}
          error={error?.login_group_name}
          required
        />
        <FormInput
          name="login_user_obs"
          type="text"
          label="Observações"
          defaultValue={usuario.login_user_obs || ''}
          onChange={(e) =>
            handleUsuarioChange('login_user_obs', e.target.value)
          }
          error={error?.login_user_obs}
        />
      </div>
    </form>
  );
};

export default DadosCadastrais;
